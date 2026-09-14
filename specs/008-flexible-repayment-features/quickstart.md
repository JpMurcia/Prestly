# Quickstart: Flexibilidad de Pago Avanzada

Verificación de punta a punta contra una base local recién reseteada, mismo estándar que `specs/001` a `specs/007`. Requiere `npx supabase db reset` después de aplicar `0008_flexible_repayment.sql`, y sesión iniciada en ambas apps (`specs/007-admin-authentication/`).

## Prerrequisitos

```bash
cd supabase
npx supabase start
npx supabase db reset
```

```bash
npm run dev -w apps/web       # http://localhost:5300
npm run web -w mobile         # http://localhost:8081 (o Expo Go/emulador)
```

Iniciar sesión con la cuenta de desarrollo (`admin@prestly.local`, `supabase/seed.sql`) en ambas apps antes de continuar.

## Historia 1 — Meses de gracia

1. En la calculadora de cotización (web o mobile), ingresar capital=$500, tasa=15%, 12 cuotas, frecuencia semanal.
2. Abrir "Configurar meses de gracia" y marcar las cuotas 3 y 5.
3. Verificar en la vista previa de la tabla: cuota 3 y cuota 5 muestran $0 / badge "Gracia" (no "Pendiente"); cuota 4 muestra $95.84 (su $47.92 + los $47.92 de la cuota 3); cuota 6 muestra $95.84 (su $47.92 + los $47.92 de la cuota 5); el resto (1-2, 7-12) sin cambios.
4. Confirmar "Emitir este préstamo" con un cliente nuevo.
5. En el detalle del préstamo ya emitido: cuotas 3 y 5 aparecen con badge "Gracia" (no con el botón "Cobrar" de una cuota pendiente); cuota 4 y 6 exigen el monto acumulado calculado en el paso 3.
6. Abrir el perfil del cliente — su score de confianza NO cuenta las cuotas 3 ni 5 en "cuotas históricas" (research.md D7) — verificar contra el denominador mostrado.
7. `curl` directo a PostgREST sin sesión sobre `cuotas` filtrando `es_gracia=eq.true` del préstamo recién creado — debe devolver `401` (RLS ya vigente, sin cambios).

**Éxito esperado**: SC-001 (menos de 1 minuto adicional sobre el flujo ya existente), SC-002 (ninguna cuota de gracia genera mora ni bloquea el préstamo).

## Historia 2 — Abonos a capital

### Modo `reducir_plazo` (default — sin tocar Configuración)

1. Sobre un préstamo activo con cuota exigible de $47.92 (cuota 1, por ejemplo), abrir "Registrar cobro".
2. Ingresar $100.00. Verificar el badge: "Excedente de $52.08 irá a Abono a Capital" (spec FR-006) ANTES de confirmar — ya no debe aparecer el bloque "Cambio a entregar" (research.md D9).
3. Confirmar. Verificar: cuota 1 → pagada; cuota 2 → pagada automáticamente (prepagada por el excedente, research.md D4); cuota 3 → pasa a "parcial" con $4.16 ya abonados (saldo restante $43.76).
4. El conteo de cuotas pendientes bajó de 11 a 9 (más el parcial) en una sola operación (spec, Historia 2, escenario 4).

### Modo `reducir_cuota` (configurado en Configuración → Modo de abono a capital)

1. En `apps/web` → Configuración, cambiar el modo a "Reducir cuota".
2. Sobre otro préstamo activo (mismo caso $500/15%/12), registrar el mismo cobro de $100.00 sobre la cuota 1.
3. Verificar: cuota 1 → pagada normalmente; cuotas 2-12 (11 cuotas) → su `monto_capital` bajó de $41.67 a ~$36.93 c/u (la 12ª absorbe el residuo), su `monto_interes` sigue en $6.25 exacto (nunca se condona — research.md D5); nueva cuota 2 = $43.18.
4. Confirmar que NINGUNA cuota futura desaparece del calendario (mismo conteo, 11 cuotas restantes) — a diferencia de `reducir_plazo`.
5. **Caso límite (research.md D5)**: registrar sobre otro préstamo un abono que cubra TODO el capital restante — verificar que las cuotas futuras quedan con `monto_capital=$0` pero `monto_interes` intacto (cuotas "solo interés"), y que el préstamo NO se marca liquidado hasta que ese interés también se cobre. No es un bug — confirmar que la UI lo explica, no lo esconde.

### Ambos modos

6. `curl` directo a PostgREST sin sesión sobre `registrar_cobro` con un `p_monto` mayor al de una cuota real — debe seguir devolviendo `401` (data-contract.md, verificación pendiente de RLS).

**Éxito esperado**: SC-003 (excedente visible antes de confirmar), SC-004 (100% de los abonos reducen la deuda exactamente por el excedente, sin fracciones de centavo perdidas).

## Historia 3 — Certificado de Paz y Salvo

1. Sobre un préstamo con una sola cuota pendiente de $47.92, registrar un cobro por exactamente ese monto (o liquidar anticipadamente, o un abono a capital que cubra el resto — cualquiera de los 3 caminos, spec FR-009).
2. Verificar que el saldo restante del préstamo llega exactamente a $0.00.
3. En el detalle del préstamo: el botón "Cobrar" ya no está disponible; en su lugar aparece "Generar Paz y Salvo" (reemplaza también a "Liquidar anticipadamente", que ya no aplica sin saldo).
4. Generar el certificado — verificar que muestra nombre del cliente, datos del préstamo (capital, cuotas), y fecha de cierre (= `paidAt` de la última cuota pagada).
5. Compartir el certificado por WhatsApp (mismo patrón que `specs/004-whatsapp-automation/`) — verificar el mensaje generado por `buildPayoffCertificateMessage`.
6. Sobre un préstamo con saldo pendiente (aunque sea $0.01), verificar que "Generar Paz y Salvo" NO está disponible.
7. Volver a generar el certificado del mismo préstamo ya saldado una segunda vez — debe funcionar igual (no persistido, bajo demanda — spec.md Assumptions).

**Éxito esperado**: SC-005 (menos de 30 segundos desde saldo $0.00), SC-006 (100% de los préstamos con saldo≠$0.00 nunca muestran la opción).

## Regresión (SC de specs anteriores que no deben romperse)

- Un préstamo SIN meses de gracia ni abonos a capital se cotiza, emite, cobra y liquida exactamente igual que antes (caso de referencia $500/15%/12 semanal → cuota $47.92, constitución).
- Pagos parciales y liquidación anticipada (`specs/003-operational-management/`) siguen funcionando sin cambios sobre préstamos sin gracia ni abonos.
- El dashboard de cartera (`cartera_resumen`, `cartera_tendencia_mensual`) sigue sumando exactamente el dinero recibido, incluidos los abonos a capital ya registrados (data-model.md: `monto` ya los incluye).
