-- Procedimientos usados por apps/mobile/src/data (contracts/data-contract.md).
-- Ambos son atómicos por construcción: una función PL/pgSQL corre como una única
-- transacción — si algo falla dentro, no queda nada a medio escribir.

-- ── Emitir un préstamo + sus cuotas de una sola vez (US1, FR-004) ─────────────────
CREATE OR REPLACE FUNCTION emitir_prestamo(
  p_cliente_id UUID,
  p_capital NUMERIC,
  p_tasa_interes NUMERIC,
  p_estrategia estrategia_interes,
  p_num_cuotas INTEGER,
  p_frecuencia frecuencia_pago,
  p_fecha_emision DATE,
  -- cada elemento: {"numero", "fecha_vencimiento", "monto_capital", "monto_interes", "monto_cuota"}
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

  INSERT INTO cuotas (prestamo_id, numero, fecha_vencimiento, monto_capital, monto_interes, monto_cuota)
  SELECT
    v_prestamo_id,
    (c ->> 'numero')::integer,
    (c ->> 'fecha_vencimiento')::date,
    (c ->> 'monto_capital')::numeric,
    (c ->> 'monto_interes')::numeric,
    (c ->> 'monto_cuota')::numeric
  FROM jsonb_array_elements(p_cuotas) AS c;

  RETURN v_prestamo_id;
END;
$$;

GRANT EXECUTE ON FUNCTION emitir_prestamo(UUID, NUMERIC, NUMERIC, estrategia_interes, INTEGER, frecuencia_pago, DATE, JSONB)
  TO anon, authenticated;

-- ── Registrar el cobro de una cuota, con guarda de concurrencia (US2, FR-008/FR-013) ──
-- Falla si la cuota ya no está 'pendiente' (pagada por otra sesión, o inexistente) en vez
-- de devolver éxito silencioso — evita duplicar un cobro tras perder la conexión (FR-013).
CREATE OR REPLACE FUNCTION registrar_cobro(p_cuota_id UUID)
RETURNS cuotas
LANGUAGE plpgsql
AS $$
DECLARE
  v_cuota cuotas;
BEGIN
  UPDATE cuotas
  SET estado = 'pagado', fecha_pago = now(), monto_pagado = monto_cuota
  WHERE id = p_cuota_id AND estado = 'pendiente'
  RETURNING * INTO v_cuota;

  IF v_cuota.id IS NULL THEN
    RAISE EXCEPTION 'CUOTA_YA_PAGADA_O_INEXISTENTE' USING ERRCODE = 'P0001';
  END IF;

  RETURN v_cuota;
END;
$$;

GRANT EXECUTE ON FUNCTION registrar_cobro(UUID) TO anon, authenticated;
