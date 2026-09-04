# Data Model: Gestión Operativa Integral — Pagos Parciales, Liquidación Anticipada y Tendencia de Cartera

Las entidades `Cliente`/`Préstamo`/`Cuota` (`spec.md` raíz §4) no cambian de forma — esta fase extiende `Cuota` con un tercer estado observable y añade una entidad nueva (`Cobro`, el historial de pagos) y dos agregados derivados nuevos (liquidación anticipada, tendencia mensual).

## Cuota — estado extendido

`estado` gana un tercer valor, `'parcial'`, entre `'pendiente'` y `'pagado'`. `monto_pagado` pasa de ser "el monto final" a ser la suma acumulada de los `Cobro` de esa cuota; `fecha_pago` se fija únicamente cuando la cuota alcanza `'pagado'` (no cambia con cada abono intermedio).

```text
pendiente ──(cobro parcial, monto < saldo)──► parcial ──(cobro por el resto)──► pagado
    │                                             │
    └──────────(cobro por el monto total)─────────┴─────────────────────────────► pagado
```

`cuotas.estado` deja de depender del tipo `ENUM estado_cuota` (riesgo de la restricción transaccional de Postgres al añadir un valor nuevo — `research.md` §4) y pasa a `TEXT` con un `CHECK`:

```sql
ALTER TABLE cuotas ALTER COLUMN estado DROP DEFAULT;
ALTER TABLE cuotas ALTER COLUMN estado TYPE TEXT USING estado::text;
ALTER TABLE cuotas ALTER COLUMN estado SET DEFAULT 'pendiente';
ALTER TABLE cuotas ADD CONSTRAINT cuotas_estado_check CHECK (estado IN ('pendiente', 'parcial', 'pagado'));
```

## Cobro — entidad nueva (historial de pagos por cuota)

No reemplaza nada — es la fuente de verdad de "qué se cobró y cuándo", con un evento por cada pago (parcial o total) registrado sobre una cuota. `cuotas.monto_pagado`/`estado`/`fecha_pago` son el resumen mantenido a partir de esta tabla, no un dato independiente.

```sql
CREATE TABLE cobros (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cuota_id       UUID NOT NULL REFERENCES cuotas(id) ON DELETE CASCADE,
  monto          NUMERIC(12,2) NOT NULL CHECK (monto > 0),
  monto_capital  NUMERIC(12,2) NOT NULL,
  monto_interes  NUMERIC(12,2) NOT NULL,
  fecha_cobro    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cobros_cuota ON cobros(cuota_id);
CREATE INDEX idx_cobros_fecha ON cobros(fecha_cobro);

-- Backfill: cada cuota ya pagada por fases anteriores gana su evento de cobro retroactivo,
-- para que la tendencia mensual (más abajo) tenga historial completo desde el día uno.
INSERT INTO cobros (cuota_id, monto, monto_capital, monto_interes, fecha_cobro)
SELECT id, monto_pagado, monto_capital, monto_interes, fecha_pago
FROM cuotas
WHERE estado = 'pagado' AND fecha_pago IS NOT NULL;
```

## `registrar_cobro` — extendido (pago total o parcial, un solo procedimiento)

Reemplaza la función de 1 argumento por una de 2 (el segundo con `DEFAULT NULL` = pagar el saldo restante completo, igual comportamiento que hoy para cualquier llamada existente). **Debe eliminarse explícitamente la firma vieja primero** — ver `research.md` §3 para por qué `CREATE OR REPLACE` por sí solo no basta.

```sql
DROP FUNCTION IF EXISTS registrar_cobro(UUID);

CREATE OR REPLACE FUNCTION registrar_cobro(p_cuota_id UUID, p_monto NUMERIC DEFAULT NULL)
RETURNS cuotas
LANGUAGE plpgsql
AS $$
DECLARE
  v_cuota cuotas;
  v_saldo_restante NUMERIC;
  v_monto_aplicado NUMERIC;
  v_capital_aplicado NUMERIC;
  v_interes_aplicado NUMERIC;
  v_nuevo_pagado NUMERIC;
  v_nuevo_estado TEXT;
BEGIN
  -- Bloquea la fila antes de leer el saldo, para que un segundo cobro concurrente sobre la
  -- misma cuota espere y vuelva a leer el estado ya actualizado (guarda de concurrencia).
  SELECT * INTO v_cuota FROM cuotas WHERE id = p_cuota_id AND estado IN ('pendiente', 'parcial') FOR UPDATE;

  IF v_cuota.id IS NULL THEN
    RAISE EXCEPTION 'CUOTA_YA_PAGADA_O_INEXISTENTE' USING ERRCODE = 'P0001';
  END IF;

  v_saldo_restante := v_cuota.monto_cuota - COALESCE(v_cuota.monto_pagado, 0);
  v_monto_aplicado := COALESCE(p_monto, v_saldo_restante); -- NULL = pagar el saldo restante completo

  IF v_monto_aplicado <= 0 OR v_monto_aplicado > v_saldo_restante THEN
    RAISE EXCEPTION 'MONTO_INVALIDO' USING ERRCODE = 'P0002';
  END IF;

  -- Reparto proporcional a la proporción capital/interés ya fijada de la cuota (FR-009).
  v_capital_aplicado := ROUND(v_monto_aplicado * v_cuota.monto_capital / v_cuota.monto_cuota, 2);
  v_interes_aplicado := v_monto_aplicado - v_capital_aplicado; -- evita descuadre de centavos

  INSERT INTO cobros (cuota_id, monto, monto_capital, monto_interes)
  VALUES (p_cuota_id, v_monto_aplicado, v_capital_aplicado, v_interes_aplicado);

  v_nuevo_pagado := COALESCE(v_cuota.monto_pagado, 0) + v_monto_aplicado;
  v_nuevo_estado := CASE WHEN v_nuevo_pagado >= v_cuota.monto_cuota THEN 'pagado' ELSE 'parcial' END;

  UPDATE cuotas
  SET estado = v_nuevo_estado,
      monto_pagado = v_nuevo_pagado,
      fecha_pago = CASE WHEN v_nuevo_estado = 'pagado' THEN now() ELSE fecha_pago END
  WHERE id = p_cuota_id
  RETURNING * INTO v_cuota;

  RETURN v_cuota;
END;
$$;

GRANT EXECUTE ON FUNCTION registrar_cobro(UUID, NUMERIC) TO anon, authenticated;
```

`MONTO_INVALIDO` (`P0002`) es un código nuevo, distinto de `CUOTA_YA_PAGADA_O_INEXISTENTE` (`P0001`) — permite a la capa de datos distinguir "esto ya no admite más pagos" de "el monto que mandaste no es válido para lo que falta", con mensajes de error distintos para el usuario.

## `liquidar_prestamo` — nuevo (liquidación anticipada, US2)

```sql
CREATE OR REPLACE FUNCTION liquidar_prestamo(p_prestamo_id UUID)
RETURNS prestamos
LANGUAGE plpgsql
AS $$
DECLARE
  v_prestamo prestamos;
  v_cuota_id UUID;
BEGIN
  SELECT * INTO v_prestamo FROM prestamos WHERE id = p_prestamo_id AND estado = 'activo' FOR UPDATE;

  IF v_prestamo.id IS NULL THEN
    RAISE EXCEPTION 'PRESTAMO_NO_ACTIVO_O_INEXISTENTE' USING ERRCODE = 'P0003';
  END IF;

  FOR v_cuota_id IN
    SELECT id FROM cuotas WHERE prestamo_id = p_prestamo_id AND estado IN ('pendiente', 'parcial')
  LOOP
    BEGIN
      -- Reutiliza el mismo procedimiento que un cobro individual — cada cuota se salda por
      -- su saldo restante exacto (p_monto NULL), fila por fila.
      PERFORM registrar_cobro(v_cuota_id);
    EXCEPTION WHEN SQLSTATE 'P0001' THEN
      -- Otra operación concurrente ya cobró esta cuota mientras liquidábamos el préstamo —
      -- no es un error para la liquidación, esa cuota simplemente ya no tiene nada pendiente.
      NULL;
    END;
  END LOOP;

  UPDATE prestamos SET estado = 'liquidado' WHERE id = p_prestamo_id RETURNING * INTO v_prestamo;

  RETURN v_prestamo;
END;
$$;

GRANT EXECUTE ON FUNCTION liquidar_prestamo(UUID) TO anon, authenticated;
```

## `cartera_tendencia_mensual` — vista nueva (US3)

No es una entidad almacenada — vista derivada, análoga a `cartera_resumen` (`specs/002-admin-web/`), que agrupa por mes tanto lo prestado (`prestamos.fecha_emision`) como lo recuperado/ganado en intereses (`cobros.fecha_cobro`).

```sql
CREATE VIEW cartera_tendencia_mensual AS
SELECT
  COALESCE(prestado.periodo, recuperado.periodo)   AS periodo,
  COALESCE(prestado.capital_prestado, 0)           AS capital_prestado,
  COALESCE(recuperado.total_recuperado, 0)         AS total_recuperado,
  COALESCE(recuperado.intereses_ganados, 0)        AS intereses_ganados
FROM
  (
    SELECT date_trunc('month', fecha_emision)::date AS periodo, SUM(capital) AS capital_prestado
    FROM prestamos
    WHERE estado IN ('activo', 'liquidado')
    GROUP BY 1
  ) AS prestado
FULL OUTER JOIN
  (
    SELECT date_trunc('month', fecha_cobro)::date AS periodo,
           SUM(monto)          AS total_recuperado,
           SUM(monto_interes)  AS intereses_ganados
    FROM cobros
    GROUP BY 1
  ) AS recuperado
ON prestado.periodo = recuperado.periodo
ORDER BY 1;
```

**Decisión de alcance**: siempre agrupa por mes calendario, sin una rama de "semanal" para carteras jóvenes — el frontend decide mostrar el estado de "historial limitado" (Historia 3, edge case) según cuántas filas devuelve esta vista, no la vista misma (`research.md` §6).

## `cartera_resumen` — corregida (spec 002, ajuste necesario por pagos parciales)

A diferencia de lo que dice la sección "Relación con `spec.md` raíz" más abajo, `cartera_resumen` **sí** necesita cambiar: su definición actual (`specs/002-admin-web/`) filtra `total_recuperado`/`intereses_ganados` por `cu.estado = 'pagado'` — una cuota `'parcial'` quedaría totalmente fuera del dashboard aunque ya se haya cobrado dinero real sobre ella, y `cartera_en_mora` sumaría el `monto_cuota` completo de una cuota vencida aunque ya se haya abonado parte. Ambos son bugs reales una vez existe el estado `'parcial'`, no un cambio de alcance.

```sql
CREATE OR REPLACE VIEW cartera_resumen AS
SELECT
  COALESCE(prestamos_agg.capital_prestado, 0)  AS capital_prestado,
  COALESCE(cobros_agg.total_recuperado, 0)     AS total_recuperado,
  COALESCE(cobros_agg.intereses_ganados, 0)    AS intereses_ganados,
  COALESCE(mora_agg.cartera_en_mora, 0)        AS cartera_en_mora,
  COALESCE(mora_agg.cuotas_en_mora, 0)         AS cuotas_en_mora,
  COALESCE(mora_agg.clientes_en_mora, 0)       AS clientes_en_mora
FROM
  (
    SELECT SUM(capital) AS capital_prestado
    FROM prestamos
    WHERE estado IN ('activo', 'liquidado')
  ) AS prestamos_agg,
  (
    -- Fuente única para "recuperado"/"intereses ganados": la tabla de hechos `cobros`,
    -- no `cuotas` filtrado por estado — así una cuota `'parcial'` sí aporta lo que
    -- realmente se cobró de ella, sin esperar a que se complete.
    SELECT SUM(monto) AS total_recuperado, SUM(monto_interes) AS intereses_ganados
    FROM cobros
  ) AS cobros_agg,
  (
    SELECT
      -- Mora ahora es el SALDO RESTANTE (no el monto original) de cuotas vencidas
      -- pendientes o parciales — lo ya cobrado de una cuota parcial no cuenta como mora.
      SUM(cu.monto_cuota - COALESCE(cu.monto_pagado, 0)) FILTER (
        WHERE cu.estado IN ('pendiente', 'parcial') AND cu.fecha_vencimiento < CURRENT_DATE
      ) AS cartera_en_mora,
      COUNT(*) FILTER (
        WHERE cu.estado IN ('pendiente', 'parcial') AND cu.fecha_vencimiento < CURRENT_DATE
      ) AS cuotas_en_mora,
      COUNT(DISTINCT p.cliente_id) FILTER (
        WHERE cu.estado IN ('pendiente', 'parcial') AND cu.fecha_vencimiento < CURRENT_DATE
      ) AS clientes_en_mora
    FROM cuotas cu
    JOIN prestamos p ON p.id = cu.prestamo_id
  ) AS mora_agg;
```

Esta `CREATE OR REPLACE VIEW` va en la misma migración `0004_pagos_parciales.sql`, después de que `cobros` ya tenga su backfill — así el primer cálculo de `total_recuperado`/`intereses_ganados` bajo la nueva definición ya incluye el historial retroactivo, sin un hueco entre "cuotas ya pagadas antes de esta fase" y "cobros nuevos".

## Otro código existente que asume estado binario (pendiente/pagado) y necesita ajuste

Dos lugares en `packages/data-supabase` calculan un saldo restante asumiendo que solo `'pagado'` aporta algo cobrado — el mismo bug que `cartera_resumen` de arriba, en TypeScript en vez de SQL:

- **`SupabaseClientRepository.ts`, `computePortfolio`**: `const pagado = c.estado === 'pagado' ? (c.monto_pagado ?? c.monto_cuota) : 0;` — debe pasar a `const pagado = c.monto_pagado ?? 0;` (crédito lo que sea que se haya recibido, sin importar el estado; para `'pendiente'` ya es `0`/`null`, para `'parcial'` es el acumulado, para `'pagado'` es el total).
- **`apps/web/src/lib/loanStatus.ts`, `deriveLoanStatus`**: mismo patrón, mismo ajuste (`i.status === 'paid' ? ... : 0` → `i.paidAmount ?? 0`).

Sin este ajuste, el saldo restante mostrado en el directorio de clientes y en cualquier vista que use `deriveLoanStatus` quedaría inflado en exactamente el monto ya cobrado parcialmente — el cliente parecería deber más de lo que realmente debe.

## Entidades — resumen

- **Cliente, Préstamo**: sin cambios de forma. `Préstamo.estado = 'liquidado'` ahora se alcanza por dos caminos (plazo normal completado, o `liquidar_prestamo`) — indistinguibles desde afuera, ambos son simplemente "liquidado".
- **Cuota**: gana el estado `'parcial'` y dueño de un historial de `Cobro` en vez de un único `monto_pagado` fijado una sola vez.
- **Cobro** (nueva): un evento de pago — cuota, monto, reparto capital/interés, fecha. Insert-only, nunca se actualiza ni se borra.
- **Tendencia de cartera** (agregado, no almacenado): `cartera_tendencia_mensual`, una fila por mes con actividad de préstamos y/o cobros.

## Relación con `spec.md` raíz y fases anteriores

```text
Cliente (1) ──< Préstamo (0..1 activo + N liquidados) ──< Cuota (N) ──< Cobro (0..N, insert-only)

VIEW cliente_score              ── ya existente, sin cambios
VIEW cartera_resumen            ── ya existente (specs/002-admin-web/); total_recuperado/intereses_ganados
                                    ahora también reflejan pagos parciales, sin cambiar su propia definición
                                    (siguen sumando cuotas.monto_pagado/monto_interes, que ya se mantienen
                                    correctamente por el registrar_cobro extendido)
VIEW cartera_tendencia_mensual  ── NUEVA — US3
```

`cartera_resumen` (spec 002) **sí cambia** — ver la sección dedicada más abajo ("`cartera_resumen` — corregida") para el porqué y su nueva definición completa.

## Migración nueva

`supabase/migrations/0004_pagos_parciales.sql` — agrupa todo lo de arriba en un solo archivo, en este orden: (0) `DROP VIEW cliente_score, cartera_resumen` — Postgres no permite `ALTER COLUMN ... TYPE` sobre una columna de la que depende una vista, así que ambas deben soltarse primero (`cliente_score` también filtra por `cuotas.estado`), (1) migrar `cuotas.estado` a `TEXT`+`CHECK`, (2) crear `cobros` + sus índices, (3) backfill de `cobros` desde cuotas ya pagadas, (4) `DROP`+`CREATE OR REPLACE` de `registrar_cobro`, (5) `CREATE FUNCTION liquidar_prestamo`, (6) recrear `cliente_score` idéntica a `0001_initial_schema.sql`, (7) recrear `cartera_resumen` corregida (sección dedicada arriba), (8) `CREATE VIEW cartera_tendencia_mensual`. No modifica `emitir_prestamo` ni ninguna tabla fuera de `cuotas`/`cobros`; `cliente_score` se recrea sin cambiar su lógica.
