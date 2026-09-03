# Data Model: Admin Web — Dashboard y Gestión de Cartera

Las entidades persistidas (Cliente, Préstamo, Cuota) son **exactamente** las de `spec.md` raíz §4, ya implementadas en `specs/001-mobile-field-app/`. Ningún campo, tipo ni restricción cambia. Este documento describe cómo esta feature las consume desde la web y qué agregados nuevos introduce a nivel de base de datos (siempre derivados, nunca almacenados — constitución Principio IV).

## Cliente, Préstamo, Cuota

Sin cambios de esquema. Reutilizan el mapeo inglés↔español ya definido en `packages/core/src/interfaces/index.ts` y las tablas `clientes`/`prestamos`/`cuotas` de `spec.md` raíz §4. La web los consume a través de las mismas interfaces (`IClientReader`/`IClientWriter`/`ILoanRepository`) que la app móvil, ver `contracts/core-interfaces.md`.

## Préstamos activos (US2) — nueva forma de lectura, no una entidad nueva

La Historia 2 necesita listar **todos** los préstamos activos (de cualquier cliente), algo que `ILoanRepository` no soportaba — sus métodos existentes (`findById`, `listByClient`, `findActiveByClient`) siempre requieren conocer un cliente de antemano. Se añade:

```
listActive(): Promise<ActiveLoanSummary[]>

interface ActiveLoanSummary {
  loan: Loan;                                    // igual que hoy — capital, cuotas, estado, etc.
  client: Pick<Client, 'id' | 'name' | 'phone'>;  // pre-unido, evita N+1 al pintar la tabla (mockup 1c)
}
```

**Consulta subyacente**: `select` sobre `prestamos` con `estado = 'activo'`, `join` a `clientes` y `cuotas` — mismo patrón de join ya usado por `listCollectionRoute` (spec 001) para evitar una petición por fila.

## Resumen de cartera (US1) — nuevo agregado derivado

No es una entidad almacenada — es una vista SQL derivada, análoga a `VIEW cliente_score` (spec.md raíz §4), que resume toda la cartera del prestamista en las cuatro métricas del dashboard (mockup 1c).

```sql
CREATE VIEW cartera_resumen AS
SELECT
  COALESCE(prestamos_agg.capital_prestado, 0)  AS capital_prestado,
  COALESCE(cuotas_agg.total_recuperado, 0)     AS total_recuperado,
  COALESCE(cuotas_agg.intereses_ganados, 0)    AS intereses_ganados,
  COALESCE(cuotas_agg.cartera_en_mora, 0)      AS cartera_en_mora,
  COALESCE(cuotas_agg.cuotas_en_mora, 0)       AS cuotas_en_mora,
  COALESCE(cuotas_agg.clientes_en_mora, 0)     AS clientes_en_mora
FROM
  (
    SELECT SUM(capital) AS capital_prestado
    FROM prestamos
    WHERE estado IN ('activo', 'liquidado')
  ) AS prestamos_agg,
  (
    SELECT
      SUM(cu.monto_pagado) FILTER (WHERE cu.estado = 'pagado')                                          AS total_recuperado,
      SUM(cu.monto_interes) FILTER (WHERE cu.estado = 'pagado')                                          AS intereses_ganados,
      SUM(cu.monto_cuota) FILTER (
        WHERE cu.estado = 'pendiente' AND cu.fecha_vencimiento < CURRENT_DATE
      )                                                                                                   AS cartera_en_mora,
      COUNT(*) FILTER (
        WHERE cu.estado = 'pendiente' AND cu.fecha_vencimiento < CURRENT_DATE
      )                                                                                                   AS cuotas_en_mora,
      COUNT(DISTINCT p.cliente_id) FILTER (
        WHERE cu.estado = 'pendiente' AND cu.fecha_vencimiento < CURRENT_DATE
      )                                                                                                   AS clientes_en_mora
    FROM cuotas cu
    JOIN prestamos p ON p.id = cu.prestamo_id
  ) AS cuotas_agg;
```

**Por qué dos subconsultas en vez de un solo `JOIN` agregado**: `capital_prestado` es un valor por-préstamo; sumarlo directamente sobre el resultado de `prestamos LEFT JOIN cuotas` lo cuenta una vez por cada cuota del préstamo (fan-out del lado "uno" de una relación uno-a-muchos), inflando el total en un factor igual al número de cuotas — confirmado contra Postgres real en T048 (un préstamo de $500 a 12 cuotas producía "capital prestado" = $6,000). Las otras cinco métricas sí son valores por-cuota (o dependen de `cliente_id` vía el join a `prestamos`), así que sumarlas sobre el join es correcto sin cambios.

**Decisión de alcance — "capital prestado"**: incluye préstamos `activo` y `liquidado` (todo lo que alguna vez se desembolsó), excluye `cancelado` (nunca se completó su desembolso). No hay una regla explícita en `spec.md` raíz para este agregado nuevo — se documenta aquí como el default razonable, coherente con que "recuperado" e "intereses ganados" ya excluyen por definición cualquier cuota que no llegó a pagarse.

**Contrato de aplicación**:

```
interface PortfolioSummary {
  principalLent: number;      // capital_prestado
  totalRecovered: number;     // total_recuperado
  interestEarned: number;     // intereses_ganados
  overdueAmount: number;      // cartera_en_mora
  overdueInstallments: number;// cuotas_en_mora
  overdueClients: number;     // clientes_en_mora
}

interface IPortfolioReader {
  getSummary(): Promise<PortfolioSummary>;
}
```

Interfaz nueva y separada de `ILoanRepository`/`IClientReader` (ISP, constitución Principio I) — el dashboard solo necesita lectura de un agregado, nada de las operaciones de escritura o de préstamo/cliente individual que ya exponen las otras interfaces.

## Estado derivado — Saldo restante por préstamo (reutilizado)

Sin cambios respecto a `specs/001-mobile-field-app/data-model.md`:

```
saldo = SUM(cuotas.monto_cuota) - SUM(cuotas.monto_pagado WHERE estado = 'pagado')
```

Mostrado en la tabla de amortización extendida (US2, columna "Saldo restante", mockup 1c) y en el panel de detalle del cliente (US3, mockup 2e).

## Estado derivado — Mora (reutilizado)

Sin cambios:

```
mora_dias = hoy - fecha_vencimiento   (solo si estado = 'pendiente' Y fecha_vencimiento < hoy)
```

Mismo cálculo que ya usa la app móvil — la web lo muestra en la tabla de préstamos activos, el directorio y el panel de detalle, nunca un número distinto entre pantallas (mismo principio que el edge case de spec 001).

## Score de confianza (reutilizado)

Sin cambios — `VIEW cliente_score` (spec.md raíz §4), leída vía `IClientReader.getScore()`, mostrada en el panel de detalle del cliente (US3, FR-006 de esta spec).

## Diagrama de relaciones

```
Cliente (1) ──< Préstamo (0..1 activo + N liquidados) ──< Cuota (N, fijas desde la emisión)

VIEW cliente_score     ── deriva de ──> Cliente + Préstamo + Cuota (solo lectura, reutilizada)
VIEW cartera_resumen    ── deriva de ──> Préstamo + Cuota (solo lectura, NUEVA — US1)
ActiveLoanSummary[]     ── deriva de ──> Préstamo (activo) + Cliente, pre-unidos (solo lectura, NUEVA — US2)
```

## Migración nueva

`supabase/migrations/0003_cartera_resumen.sql` — agrega únicamente la `VIEW cartera_resumen` de arriba. No modifica ninguna tabla, tipo ni función existente de `0001_initial_schema.sql`/`0002_procedures.sql`.
