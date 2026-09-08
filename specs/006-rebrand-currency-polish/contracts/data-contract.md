# Contract: esquema SQL y acceso desde `supabase-js`

## Migración `0006_configuracion_app.sql`

```sql
CREATE TABLE configuracion_app (
  id             SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  moneda         TEXT NOT NULL DEFAULT 'COP' CHECK (moneda IN ('COP','USD','MXN')),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO configuracion_app (id, moneda) VALUES (1, 'COP');
```

Sin `ROW LEVEL SECURITY`, sin `GRANT` explícito — mismo nivel de acceso abierto para `anon`/`authenticated` que ya tienen `clientes`/`prestamos`/`cuotas` en este proyecto (confirmado: ninguna tabla de `supabase/migrations/*.sql` tiene RLS habilitado hoy).

## `SupabaseAppSettingsRepository` (implementa `IAppSettingsRepository`)

```ts
// packages/data-supabase/src/SupabaseAppSettingsRepository.ts
class SupabaseAppSettingsRepository implements IAppSettingsRepository {
  async getSettings(): Promise<AppSettings> {
    // select moneda from configuracion_app where id = 1 (.single())
  }

  async updateCurrency(currency: CurrencyCode): Promise<AppSettings> {
    // update configuracion_app set moneda = :currency, actualizado_en = now()
    // where id = 1 .select('moneda').single()
  }
}
```

Mismo patrón que `SupabaseClientRepository`: acceso directo a la tabla vía `supabase-js`, sin RPC — no requerido porque no hay lógica de negocio en el servidor más allá de la restricción `CHECK`, a diferencia de `registrar_cobro`/`liquidar_prestamo` (que sí necesitan atomicidad multi-fila).

## Consumo en cada app

- **apps/web**: `useAppSettings()` (React Query) expone `{ currency, updateCurrency }`; `updateCurrency` invalida `['appSettings']` en `onSuccess` para que todas las pantallas abiertas en esa sesión (Dashboard, Calculadora, Clientes, Préstamos) vuelvan a formatear de inmediato (FR-003) — mismo patrón que `useSaveWhatsAppCredentials` invalidando `['whatsAppConfigStatus']`.
- **apps/mobile**: `useAppSettings()` solo expone `{ currency }` (sin mutación) — la app nunca llama a `updateCurrency` (FR-004). `staleTime` corto (o `refetchOnMount: 'always'`) para que abrir la app recoja un cambio hecho desde la web sin requerir tiempo real (Edge Cases de spec.md).

## Sin cambios a `emitir_prestamo`, `registrar_cobro`, `liquidar_prestamo`

Ninguna función RPC existente cambia de firma ni de comportamiento — la moneda es puramente de presentación (formato), nunca se envía a estas funciones ni se guarda junto al préstamo/cuota (un préstamo no "tiene" una moneda propia; toda la instalación se ve en la misma moneda activa en el momento de mostrarlo).
