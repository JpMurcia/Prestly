-- Flexibilidad de Pago Avanzada (specs/008-flexible-repayment-features/): meses de gracia,
-- abonos a capital y Certificado de Paz y Salvo. Ver data-model.md para el razonamiento
-- completo de cada decisión. Ninguna tabla ni función nueva se expone vía PostgREST — solo se
-- extienden 3 columnas y se reemplazan 3 objetos ya existentes con la MISMA firma, así que los
-- GRANT/REVOKE de 0007_auth_rls.sql siguen vigentes sin cambios (research.md D3).

-- ── 1. cuotas.es_gracia ──────────────────────────────────────────────────────
ALTER TABLE cuotas ADD COLUMN es_gracia BOOLEAN NOT NULL DEFAULT false;

-- ── 2. cobros.abono_capital ──────────────────────────────────────────────────
ALTER TABLE cobros ADD COLUMN abono_capital NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (abono_capital >= 0);

-- ── 3. configuracion_app.modo_abono_capital ──────────────────────────────────
ALTER TABLE configuracion_app
  ADD COLUMN modo_abono_capital TEXT NOT NULL DEFAULT 'reducir_plazo'
    CHECK (modo_abono_capital IN ('reducir_plazo', 'reducir_cuota'));

-- ── 4. emitir_prestamo: extendido (misma firma, p_cuotas admite "es_gracia") ──
-- Una cuota de gracia se inserta directamente en $0/'pagado' — su monto original ya fue
-- trasladado a la cuota siguiente por applyGracePeriods (@repo/core) antes de llegar aquí
-- (research.md D1/D8). Evita tocar mora/cobranza: idx_cuotas_pendientes y listCollectionRoute
-- ya filtran por estado IN ('pendiente','parcial').
CREATE OR REPLACE FUNCTION emitir_prestamo(
  p_cliente_id UUID,
  p_capital NUMERIC,
  p_tasa_interes NUMERIC,
  p_estrategia estrategia_interes,
  p_num_cuotas INTEGER,
  p_frecuencia frecuencia_pago,
  p_fecha_emision DATE,
  -- cada elemento: {"numero", "fecha_vencimiento", "monto_capital", "monto_interes", "monto_cuota", "es_gracia"?}
  p_cuotas JSONB
) RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_prestamo_id UUID;
BEGIN
  INSERT INTO prestamos (cliente_id, capital, tasa_interes, estrategia, num_cuotas, frecuencia, fecha_emision)
  VALUES (p_cliente_id, p_capital, p_tasa_interes, p_estrategia, p_num_cuotas, p_frecuencia, p_fecha_emision)
  RETURNING id INTO v_prestamo_id;

  INSERT INTO cuotas (
    prestamo_id, numero, fecha_vencimiento, monto_capital, monto_interes, monto_cuota,
    es_gracia, estado, monto_pagado, fecha_pago
  )
  SELECT
    v_prestamo_id,
    (c ->> 'numero')::integer,
    (c ->> 'fecha_vencimiento')::date,
    CASE WHEN COALESCE((c ->> 'es_gracia')::boolean, false) THEN 0 ELSE (c ->> 'monto_capital')::numeric END,
    CASE WHEN COALESCE((c ->> 'es_gracia')::boolean, false) THEN 0 ELSE (c ->> 'monto_interes')::numeric END,
    CASE WHEN COALESCE((c ->> 'es_gracia')::boolean, false) THEN 0 ELSE (c ->> 'monto_cuota')::numeric END,
    COALESCE((c ->> 'es_gracia')::boolean, false),
    CASE WHEN COALESCE((c ->> 'es_gracia')::boolean, false) THEN 'pagado' ELSE 'pendiente' END,
    CASE WHEN COALESCE((c ->> 'es_gracia')::boolean, false) THEN 0 ELSE NULL END,
    CASE WHEN COALESCE((c ->> 'es_gracia')::boolean, false) THEN (c ->> 'fecha_vencimiento')::date ELSE NULL END
  FROM jsonb_array_elements(p_cuotas) AS c;

  RETURN v_prestamo_id;
END;
$$;
-- Firma sin cambios respecto a 0002_procedures.sql — el GRANT/REVOKE de 0007_auth_rls.sql
-- (REVOKE EXECUTE ... FROM PUBLIC, anon) sigue aplicando sin necesidad de repetirlo aquí.

-- ── 5. Funciones auxiliares de abono a capital (research.md D4/D5) ───────────
-- Privadas: no se exponen vía PostgREST, solo las llama registrar_cobro (paso 6) desde dentro
-- de Postgres. Por defensa en profundidad contra el hallazgo de spec 007 T028 (Postgres otorga
-- EXECUTE a PUBLIC por defecto en toda función nueva), llevan su propio REVOKE explícito.

-- Modo "reducir_plazo" (default): prepaga cuotas futuras COMPLETAS, en orden, a su monto ya
-- fijado (capital+interés íntegros) — nunca condona interés (spec FR-008). Si el excedente
-- agota todas las cuotas pendientes/parciales, el préstamo queda liquidado (mismo criterio que
-- liquidar_prestamo, 0004_pagos_parciales.sql).
CREATE OR REPLACE FUNCTION aplicar_abono_reducir_plazo(p_prestamo_id UUID, p_excedente NUMERIC)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_cuota RECORD;
  v_restante NUMERIC := p_excedente;
  v_saldo NUMERIC;
  v_aplicado NUMERIC;
  v_capital NUMERIC;
  v_interes NUMERIC;
  v_nuevo_pagado NUMERIC;
  v_nuevo_estado TEXT;
  v_quedan_pendientes INTEGER;
BEGIN
  FOR v_cuota IN
    SELECT * FROM cuotas
    WHERE prestamo_id = p_prestamo_id AND estado IN ('pendiente', 'parcial')
    ORDER BY numero
    FOR UPDATE
  LOOP
    EXIT WHEN v_restante <= 0;

    v_saldo := v_cuota.monto_cuota - COALESCE(v_cuota.monto_pagado, 0);
    v_aplicado := LEAST(v_restante, v_saldo);

    -- Mismo reparto proporcional capital/interés que registrar_cobro (FR-009, 0004_pagos_parciales.sql).
    v_capital := ROUND(v_aplicado * v_cuota.monto_capital / v_cuota.monto_cuota, 2);
    v_interes := v_aplicado - v_capital;

    -- abono_capital = 0: esta fila es el cobro NORMAL de esta cuota (ya fijada), prepagada
    -- antes de su vencimiento — el abono en sí quedó registrado en la fila que lo originó.
    INSERT INTO cobros (cuota_id, monto, monto_capital, monto_interes, abono_capital)
    VALUES (v_cuota.id, v_aplicado, v_capital, v_interes, 0);

    v_nuevo_pagado := COALESCE(v_cuota.monto_pagado, 0) + v_aplicado;
    v_nuevo_estado := CASE WHEN v_nuevo_pagado >= v_cuota.monto_cuota THEN 'pagado' ELSE 'parcial' END;

    UPDATE cuotas
    SET estado = v_nuevo_estado,
        monto_pagado = v_nuevo_pagado,
        fecha_pago = CASE WHEN v_nuevo_estado = 'pagado' THEN now() ELSE fecha_pago END
    WHERE id = v_cuota.id;

    v_restante := v_restante - v_aplicado;
  END LOOP;

  SELECT COUNT(*) INTO v_quedan_pendientes FROM cuotas
  WHERE prestamo_id = p_prestamo_id AND estado IN ('pendiente', 'parcial');

  IF v_quedan_pendientes = 0 THEN
    UPDATE prestamos SET estado = 'liquidado' WHERE id = p_prestamo_id AND estado = 'activo';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION aplicar_abono_reducir_plazo(UUID, NUMERIC) FROM PUBLIC, anon;

-- Modo "reducir_cuota": reduce el CAPITAL restante de las cuotas futuras (nunca su interés, ya
-- fijado y nunca condonado — spec FR-008/research.md D5). Si el excedente supera el capital
-- restante, el capital futuro llega a $0 pero el interés sigue debiéndose (consecuencia
-- documentada, no un bug).
CREATE OR REPLACE FUNCTION aplicar_abono_reducir_cuota(p_prestamo_id UUID, p_excedente NUMERIC)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_cuota RECORD;
  v_capital_restante NUMERIC := 0;
  v_nuevo_capital_total NUMERIC;
  v_cantidad INTEGER := 0;
  v_asignado NUMERIC := 0;
  v_capital_fila NUMERIC;
  v_es_ultima BOOLEAN;
  v_max_numero INTEGER;
BEGIN
  -- Bloquea las cuotas futuras primero — Postgres no permite FOR UPDATE junto con funciones de
  -- agregado, así que el bloqueo y el cálculo del capital pendiente van en pasadas separadas
  -- (el bloqueo ya tomado protege la consistencia entre ambas dentro de esta transacción).
  PERFORM 1 FROM cuotas
  WHERE prestamo_id = p_prestamo_id AND estado IN ('pendiente', 'parcial')
  FOR UPDATE;

  -- Capital pendiente real de cada cuota futura (descuenta lo ya cobrado de una cuota
  -- 'parcial', mismo reparto proporcional que registrar_cobro) y el conteo a redistribuir.
  SELECT
    SUM(monto_capital - ROUND(COALESCE(monto_pagado, 0) * monto_capital / monto_cuota, 2)),
    COUNT(*),
    MAX(numero)
  INTO v_capital_restante, v_cantidad, v_max_numero
  FROM cuotas
  WHERE prestamo_id = p_prestamo_id AND estado IN ('pendiente', 'parcial');

  IF v_cantidad = 0 THEN
    RETURN; -- nada que redistribuir (el excedente ya cubrió absolutamente todo, caso límite)
  END IF;

  -- Nunca negativo — si el excedente supera el capital restante, el capital futuro llega a $0
  -- pero el interés de cada cuota NUNCA se toca (research.md D5, consecuencia documentada).
  v_nuevo_capital_total := GREATEST(v_capital_restante - p_excedente, 0);

  FOR v_cuota IN
    SELECT * FROM cuotas
    WHERE prestamo_id = p_prestamo_id AND estado IN ('pendiente', 'parcial')
    ORDER BY numero
  LOOP
    v_es_ultima := (v_cuota.numero = v_max_numero);

    v_capital_fila := CASE WHEN v_es_ultima
      THEN ROUND(v_nuevo_capital_total - v_asignado, 2)  -- la última absorbe el residuo (§5.3)
      ELSE ROUND(v_nuevo_capital_total / v_cantidad, 2)
    END;

    v_asignado := v_asignado + v_capital_fila;

    UPDATE cuotas
    SET monto_capital = v_capital_fila,
        monto_cuota = v_capital_fila + monto_interes  -- monto_interes NUNCA se toca (D5)
    WHERE id = v_cuota.id;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION aplicar_abono_reducir_cuota(UUID, NUMERIC) FROM PUBLIC, anon;

-- ── 6. registrar_cobro: extendido (misma firma, ya no rechaza el excedente) ──
CREATE OR REPLACE FUNCTION registrar_cobro(p_cuota_id UUID, p_monto NUMERIC DEFAULT NULL)
RETURNS cuotas
LANGUAGE plpgsql
AS $$
DECLARE
  v_cuota cuotas;
  v_prestamo_id UUID;
  v_saldo_restante NUMERIC;
  v_monto_aplicado NUMERIC;
  v_excedente NUMERIC;
  v_capital_aplicado NUMERIC;
  v_interes_aplicado NUMERIC;
  v_nuevo_pagado NUMERIC;
  v_nuevo_estado TEXT;
  v_modo TEXT;
BEGIN
  -- Bloquea la fila antes de leer el saldo — igual guarda de concurrencia ya vigente desde
  -- 0004_pagos_parciales.sql.
  SELECT * INTO v_cuota FROM cuotas WHERE id = p_cuota_id AND estado IN ('pendiente', 'parcial') FOR UPDATE;

  IF v_cuota.id IS NULL THEN
    RAISE EXCEPTION 'CUOTA_YA_PAGADA_O_INEXISTENTE' USING ERRCODE = 'P0001';
  END IF;
  v_prestamo_id := v_cuota.prestamo_id;

  v_saldo_restante := v_cuota.monto_cuota - COALESCE(v_cuota.monto_pagado, 0);
  v_monto_aplicado := LEAST(COALESCE(p_monto, v_saldo_restante), v_saldo_restante);
  -- research.md D3: ya no se rechaza p_monto > v_saldo_restante — el excedente se convierte
  -- en abono a capital en vez de MONTO_INVALIDO.
  v_excedente := GREATEST(COALESCE(p_monto, v_saldo_restante) - v_saldo_restante, 0);

  IF COALESCE(p_monto, v_saldo_restante) <= 0 THEN
    RAISE EXCEPTION 'MONTO_INVALIDO' USING ERRCODE = 'P0002';
  END IF;

  -- Reparto proporcional a la proporción capital/interés ya fijada de la cuota (FR-009).
  v_capital_aplicado := ROUND(v_monto_aplicado * v_cuota.monto_capital / v_cuota.monto_cuota, 2);
  v_interes_aplicado := v_monto_aplicado - v_capital_aplicado;

  -- monto = monto_capital + monto_interes + abono_capital (data-model.md, invariante de cobros).
  INSERT INTO cobros (cuota_id, monto, monto_capital, monto_interes, abono_capital)
  VALUES (p_cuota_id, v_monto_aplicado + v_excedente, v_capital_aplicado, v_interes_aplicado, v_excedente);

  v_nuevo_pagado := COALESCE(v_cuota.monto_pagado, 0) + v_monto_aplicado;
  v_nuevo_estado := CASE WHEN v_nuevo_pagado >= v_cuota.monto_cuota THEN 'pagado' ELSE 'parcial' END;

  UPDATE cuotas
  SET estado = v_nuevo_estado,
      monto_pagado = v_nuevo_pagado,
      fecha_pago = CASE WHEN v_nuevo_estado = 'pagado' THEN now() ELSE fecha_pago END
  WHERE id = p_cuota_id
  RETURNING * INTO v_cuota;

  -- ── Excedente → abono a capital (research.md D4/D5) ──────────────────────
  IF v_excedente > 0 THEN
    SELECT modo_abono_capital INTO v_modo FROM configuracion_app WHERE id = 1;

    IF v_modo = 'reducir_plazo' THEN
      PERFORM aplicar_abono_reducir_plazo(v_prestamo_id, v_excedente);
    ELSE
      PERFORM aplicar_abono_reducir_cuota(v_prestamo_id, v_excedente);
    END IF;
  END IF;

  RETURN v_cuota;
END;
$$;
-- Firma sin cambios respecto a 0004_pagos_parciales.sql — el REVOKE de 0007_auth_rls.sql sigue
-- aplicando sin necesidad de repetirlo aquí (research.md D3).

-- ── 7. cliente_score: misma vista, excluye cuotas de gracia (research.md D7) ──
-- Una cuota de gracia nace 'pagado'/$0 (paso 4) — sin este ajuste, cada mes de gracia inflaría
-- artificialmente la puntualidad del cliente. Columnas de salida idénticas a la definición
-- actual (0001_initial_schema.sql / 0004_pagos_parciales.sql) — CREATE OR REPLACE alcanza.
CREATE OR REPLACE VIEW cliente_score AS
SELECT
  c.id AS cliente_id,
  COUNT(cu.*) FILTER (WHERE cu.estado = 'pagado' AND NOT cu.es_gracia) AS cuotas_pagadas,
  COUNT(cu.*) FILTER (WHERE cu.fecha_vencimiento <= CURRENT_DATE AND NOT cu.es_gracia) AS cuotas_historicas,
  ROUND(
    COUNT(cu.*) FILTER (WHERE cu.estado = 'pagado' AND NOT cu.es_gracia AND cu.fecha_pago::date <= cu.fecha_vencimiento)::numeric
    / NULLIF(COUNT(cu.*) FILTER (WHERE cu.fecha_vencimiento <= CURRENT_DATE AND NOT cu.es_gracia), 0),
    4
  ) AS puntualidad,
  CASE
    WHEN COUNT(cu.*) FILTER (WHERE cu.fecha_vencimiento <= CURRENT_DATE AND NOT cu.es_gracia) = 0 THEN NULL
    WHEN ROUND(COUNT(cu.*) FILTER (WHERE cu.estado='pagado' AND NOT cu.es_gracia AND cu.fecha_pago::date <= cu.fecha_vencimiento)::numeric
      / NULLIF(COUNT(cu.*) FILTER (WHERE cu.fecha_vencimiento <= CURRENT_DATE AND NOT cu.es_gracia), 0), 4) >= 0.95 THEN 'A+'
    WHEN ROUND(COUNT(cu.*) FILTER (WHERE cu.estado='pagado' AND NOT cu.es_gracia AND cu.fecha_pago::date <= cu.fecha_vencimiento)::numeric
      / NULLIF(COUNT(cu.*) FILTER (WHERE cu.fecha_vencimiento <= CURRENT_DATE AND NOT cu.es_gracia), 0), 4) >= 0.85 THEN 'A'
    WHEN ROUND(COUNT(cu.*) FILTER (WHERE cu.estado='pagado' AND NOT cu.es_gracia AND cu.fecha_pago::date <= cu.fecha_vencimiento)::numeric
      / NULLIF(COUNT(cu.*) FILTER (WHERE cu.fecha_vencimiento <= CURRENT_DATE AND NOT cu.es_gracia), 0), 4) >= 0.70 THEN 'B'
    ELSE 'C'
  END AS grado
FROM clientes c
LEFT JOIN prestamos p ON p.cliente_id = c.id
LEFT JOIN cuotas cu ON cu.prestamo_id = p.id
GROUP BY c.id;
