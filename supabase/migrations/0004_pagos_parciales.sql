-- Gestión Operativa Integral (Fase 4 del negocio): pagos parciales, liquidación anticipada
-- y tendencia de cartera. Ver specs/003-operational-management/data-model.md para el
-- razonamiento completo de cada decisión.

-- ── 0. Vistas e índice que dependen de cuotas.estado deben soltarse antes de retiparlo ──
-- Postgres no permite ALTER COLUMN ... TYPE sobre una columna de la que depende una vista o
-- un índice parcial. Se recrean idénticas (cliente_score) o corregidas (cartera_resumen,
-- idx_cuotas_pendientes) más abajo.
DROP VIEW cliente_score;
DROP VIEW cartera_resumen;
DROP INDEX idx_cuotas_pendientes;

-- ── 1. cuotas.estado: de ENUM a TEXT + CHECK ───────────────────────────────
-- Evita el riesgo de la restricción de Postgres sobre usar un valor de ENUM nuevo dentro de
-- la misma transacción en que se añadió (research.md §4). El tipo estado_cuota queda sin usar
-- (no se borra, por si algo más lo referenciara).
ALTER TABLE cuotas ALTER COLUMN estado DROP DEFAULT;
ALTER TABLE cuotas ALTER COLUMN estado TYPE TEXT USING estado::text;
ALTER TABLE cuotas ALTER COLUMN estado SET DEFAULT 'pendiente';
ALTER TABLE cuotas ADD CONSTRAINT cuotas_estado_check CHECK (estado IN ('pendiente', 'parcial', 'pagado'));

-- Recreada — ahora también cubre 'parcial': una cuota parcialmente pagada sigue teniendo
-- saldo pendiente y debe seguir apareciendo en listCollectionRoute/consultas de "por cobrar"
-- igual que una 'pendiente' (ver ajuste correspondiente en SupabaseLoanRepository.ts).
CREATE INDEX idx_cuotas_pendientes ON cuotas(fecha_vencimiento) WHERE estado IN ('pendiente', 'parcial');

-- ── 2. cobros: historial de pagos por cuota (nueva) ────────────────────────
-- Hecho crudo — un evento por cada pago (parcial o total). cuotas.monto_pagado/estado/
-- fecha_pago son el resumen mantenido a partir de esto, no un dato independiente.
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

-- ── 3. Backfill: cuotas ya pagadas por fases anteriores ganan su evento retroactivo ──
-- Para que cartera_tendencia_mensual (§7) tenga historial completo desde el día uno.
INSERT INTO cobros (cuota_id, monto, monto_capital, monto_interes, fecha_cobro)
SELECT id, monto_pagado, monto_capital, monto_interes, fecha_pago
FROM cuotas
WHERE estado = 'pagado' AND fecha_pago IS NOT NULL;

-- ── 4. registrar_cobro: extendido para pago total o parcial ────────────────
-- Debe eliminarse la firma vieja de 1 argumento explícitamente antes de crear la de 2 —
-- CREATE OR REPLACE por sí solo crearía una segunda función sobrecargada en vez de
-- reemplazar la existente (research.md §3), y una llamada de 1 argumento seguiría
-- resolviendo a la implementación vieja, que no sabe nada de 'parcial' ni de cobros.
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
  -- Bloquea la fila antes de leer el saldo — un segundo cobro concurrente sobre la misma
  -- cuota espera aquí y, al desbloquearse, relee el estado ya actualizado por el primero.
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

-- ── 5. liquidar_prestamo: nuevo (liquidación anticipada) ───────────────────
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
      -- no es un error para la liquidación, esa cuota simplemente ya no tenía nada pendiente.
      NULL;
    END;
  END LOOP;

  UPDATE prestamos SET estado = 'liquidado' WHERE id = p_prestamo_id RETURNING * INTO v_prestamo;

  RETURN v_prestamo;
END;
$$;

GRANT EXECUTE ON FUNCTION liquidar_prestamo(UUID) TO anon, authenticated;

-- ── 6. cliente_score: recreada idéntica (0001_initial_schema.sql) ──────────
-- Ninguna lógica cambia — solo se recrea porque el DROP de arriba la quitó.
CREATE VIEW cliente_score AS
SELECT
  c.id AS cliente_id,
  COUNT(cu.*) FILTER (WHERE cu.estado = 'pagado') AS cuotas_pagadas,
  COUNT(cu.*) FILTER (WHERE cu.fecha_vencimiento <= CURRENT_DATE) AS cuotas_historicas,
  ROUND(
    COUNT(cu.*) FILTER (WHERE cu.estado = 'pagado' AND cu.fecha_pago::date <= cu.fecha_vencimiento)::numeric
    / NULLIF(COUNT(cu.*) FILTER (WHERE cu.fecha_vencimiento <= CURRENT_DATE), 0),
    4
  ) AS puntualidad,
  CASE
    WHEN COUNT(cu.*) FILTER (WHERE cu.fecha_vencimiento <= CURRENT_DATE) = 0 THEN NULL -- sin historial
    WHEN ROUND(COUNT(cu.*) FILTER (WHERE cu.estado='pagado' AND cu.fecha_pago::date <= cu.fecha_vencimiento)::numeric
      / NULLIF(COUNT(cu.*) FILTER (WHERE cu.fecha_vencimiento <= CURRENT_DATE), 0), 4) >= 0.95 THEN 'A+'
    WHEN ROUND(COUNT(cu.*) FILTER (WHERE cu.estado='pagado' AND cu.fecha_pago::date <= cu.fecha_vencimiento)::numeric
      / NULLIF(COUNT(cu.*) FILTER (WHERE cu.fecha_vencimiento <= CURRENT_DATE), 0), 4) >= 0.85 THEN 'A'
    WHEN ROUND(COUNT(cu.*) FILTER (WHERE cu.estado='pagado' AND cu.fecha_pago::date <= cu.fecha_vencimiento)::numeric
      / NULLIF(COUNT(cu.*) FILTER (WHERE cu.fecha_vencimiento <= CURRENT_DATE), 0), 4) >= 0.70 THEN 'B'
    ELSE 'C'
  END AS grado
FROM clientes c
LEFT JOIN prestamos p ON p.cliente_id = c.id
LEFT JOIN cuotas cu ON cu.prestamo_id = p.id
GROUP BY c.id;

-- ── 7. cartera_resumen: recreada y corregida (specs/002-admin-web/) ────────
-- Con 'parcial' en juego, la definición anterior (filtrando por estado = 'pagado') dejaba
-- fuera dinero ya cobrado de cuotas parciales, y cartera_en_mora sumaba el monto_cuota
-- completo de una cuota vencida aunque ya se hubiera abonado parte. Ambos son bugs reales,
-- no un cambio de alcance — ver data-model.md.
CREATE VIEW cartera_resumen AS
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
    -- Fuente única para "recuperado"/"intereses ganados": la tabla de hechos cobros, no
    -- cuotas filtrado por estado — así una cuota 'parcial' aporta lo que ya se cobró de ella.
    SELECT SUM(monto) AS total_recuperado, SUM(monto_interes) AS intereses_ganados
    FROM cobros
  ) AS cobros_agg,
  (
    SELECT
      -- Mora es el SALDO RESTANTE (no el monto original) de cuotas vencidas pendientes o
      -- parciales — lo ya cobrado de una cuota parcial no cuenta como mora.
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

-- ── 8. cartera_tendencia_mensual: nueva (US3) ───────────────────────────────
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
