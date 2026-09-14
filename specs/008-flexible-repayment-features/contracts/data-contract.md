# Data Contract: Flexibilidad de Pago Avanzada

Acceso desde `packages/data-supabase` — mismo nivel de acceso ya vigente desde `specs/007-admin-authentication/` (RLS activa, `authenticated` requerido; `anon` sin acceso a ninguna tabla ni función de negocio). Ninguna tabla ni RPC nueva — ver `data-model.md`.

## `cuotas` / `cobros` / `configuracion_app` — columnas nuevas

Acceso directo por `supabase-js` (`select`/`insert`/`update`), igual que hoy — `es_gracia`, `abono_capital` y `modo_abono_capital` no son secretos, mismo criterio ya documentado en `0006_configuracion_app.sql` para `moneda`.

```typescript
// SupabaseLoanRepository.ts — mapeo de fila a dominio
interface CuotaRow {
  // ...columnas existentes...
  es_gracia: boolean;
}
// → LoanInstallment.isGrace = row.es_gracia

interface CobroRow {
  // ...columnas existentes...
  abono_capital: number;
}
```

## `emitir_prestamo` — llamada desde `SupabaseLoanRepository.save`

Sin cambios de firma. El arreglo que hoy se serializa a `p_cuotas` gana `es_gracia` por elemento, tomado de `GracedInstallment.isGrace` (o `false` si el préstamo no usó gracia — `NewLoan.installments` sigue siendo compatible con `Installment[]` simple cuando no hay gracia, `isGrace` es opcional en ese caso y se serializa `false`).

```typescript
await supabase.rpc('emitir_prestamo', {
  p_cliente_id: clientId,
  // ...resto de parámetros sin cambios...
  p_cuotas: loan.installments.map((i) => ({
    numero: i.number,
    fecha_vencimiento: toDateOnly(i.dueDate),
    monto_capital: i.principalPortion,
    monto_interes: i.interestPortion,
    monto_cuota: i.totalAmount,
    es_gracia: 'isGrace' in i ? i.isGrace : false,
  })),
});
```

## `registrar_cobro` — llamada desde `SupabaseLoanRepository.registerInstallmentPayment`

Sin cambios de firma (`p_cuota_id`, `p_monto`) ni de código de error nuevo — `MONTO_INVALIDO` (`P0002`) sigue existiendo, pero ya no se dispara por exceder el saldo restante (eso ahora es válido, ver `data-model.md`), solo por `p_monto <= 0`. El repositorio ya no puede leer `principalContributionApplied`/`loanSettled` directamente del `cuotas` que devuelve la función (esa fila solo describe la cuota pagada) — necesita una segunda lectura liviana tras la RPC:

```typescript
async registerInstallmentPayment(installmentId: string, amount: number): Promise<RegisterInstallmentPaymentResult> {
  const { data: cuota, error } = await this.supabase
    .rpc('registrar_cobro', { p_cuota_id: installmentId, p_monto: amount })
    .single<CuotaRow>();
  if (error) throw mapRegistrarCobroError(error); // CUOTA_YA_PAGADA_O_INEXISTENTE / MONTO_INVALIDO, ya existente

  // El excedente aplicado a ESTE cobro específico queda en la fila de `cobros` que
  // registrar_cobro insertó en la misma transacción — se lee por cuota_id + más reciente,
  // no hace falta que la función devuelva más que la cuota (mismo patrón ya usado por
  // liquidar_prestamo, que tampoco necesita devolver el detalle de cada cuota que salda).
  const { data: cobro } = await this.supabase
    .from('cobros')
    .select('abono_capital')
    .eq('cuota_id', installmentId)
    .order('fecha_cobro', { ascending: false })
    .limit(1)
    .single<{ abono_capital: number }>();

  const { data: prestamo } = await this.supabase
    .from('prestamos')
    .select('estado')
    .eq('id', cuota.prestamo_id)
    .single<{ estado: string }>();

  return {
    installment: mapCuotaRowToLoanInstallment(cuota),
    principalContributionApplied: cobro?.abono_capital ?? 0,
    loanSettled: prestamo?.estado === 'liquidado',
  };
}
```

**Nota de implementación para `/speckit-tasks`**: esta doble lectura introduce una ventana no atómica entre `registrar_cobro` y las dos consultas de seguimiento — aceptable porque son de solo lectura y el prestamista único ya confirmó la operación (no hay una segunda escritura en juego); si `/speckit-plan-review` u otra revisión prefiere evitarlo, la alternativa es que `registrar_cobro` devuelva un tipo compuesto (`cuotas` + `abono_capital` + `estado_prestamo`) en vez de `RETURNS cuotas` — decisión que se cierra en `/speckit-tasks`, no aquí.

## `configuracion_app.modo_abono_capital` — `SupabaseAppSettingsRepository`

```typescript
async getSettings(): Promise<AppSettings> {
  const { data, error } = await this.supabase
    .from('configuracion_app')
    .select('moneda, modo_abono_capital')
    .eq('id', 1)
    .single<{ moneda: CurrencyCode; modo_abono_capital: 'reducir_plazo' | 'reducir_cuota' }>();
  if (error) throw error;
  return {
    currency: data.moneda,
    principalContributionMode: data.modo_abono_capital === 'reducir_plazo' ? 'reduce_term' : 'reduce_installment',
  };
}

async updatePrincipalContributionMode(mode: PrincipalContributionMode): Promise<AppSettings> {
  const { data, error } = await this.supabase
    .from('configuracion_app')
    .update({ modo_abono_capital: mode === 'reduce_term' ? 'reducir_plazo' : 'reducir_cuota', actualizado_en: new Date().toISOString() })
    .eq('id', 1)
    .select('moneda, modo_abono_capital')
    .single();
  if (error) throw error;
  return { currency: data.moneda, principalContributionMode: /* mismo mapeo */ };
}
```

## RLS — sin cambios (research.md D3)

`cuotas`, `cobros`, `configuracion_app` ya tienen su política `FOR ALL TO authenticated USING (true) WITH CHECK (true)` desde `0007_auth_rls.sql` — las columnas nuevas quedan cubiertas automáticamente (una política de tabla no distingue por columna). `registrar_cobro`/`emitir_prestamo` ya tienen `REVOKE EXECUTE ... FROM PUBLIC, anon` — sin `GRANT`/`REVOKE` nuevo al no cambiar de firma. Las funciones auxiliares `aplicar_abono_reducir_plazo`/`aplicar_abono_reducir_cuota` (`data-model.md`) deben llevar el mismo `REVOKE` por defensa en profundidad, aunque no se invocan directamente vía PostgREST.

**Verificación pendiente para `/speckit-tasks` (mismo estándar que spec 007 T028)**: `curl` directo a PostgREST sin sesión contra `registrar_cobro` con un `p_monto` mayor al de la cuota — debe seguir devolviendo `401`, igual que cualquier otro monto.
