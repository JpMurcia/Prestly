# Data Model: Flexibilidad de Pago Avanzada — Meses de Gracia, Abonos a Capital y Paz y Salvo

Las entidades `Cliente`/`Préstamo` (`spec.md` raíz §4) no cambian de forma. `Cuota` y `Cobro` (`specs/003-operational-management/`) ganan una columna cada una; `configuracion_app` (`specs/006-rebrand-currency-polish/`) gana una tercera columna de ajuste. Ninguna tabla ni función nueva — ver research.md D3/D6.

## Cuota — columna nueva `es_gracia`

```sql
ALTER TABLE cuotas ADD COLUMN es_gracia BOOLEAN NOT NULL DEFAULT false;
```

Fijada una sola vez al estructurar el préstamo (junto con `monto_capital`/`monto_interes`/`fecha_vencimiento`), igual categoría de dato que esas tres — nunca cambia después de `emitir_prestamo` (research.md D8). Una cuota `es_gracia = true` se inserta directamente con:

```text
estado = 'pagado'
monto_capital = 0
monto_interes = 0
monto_cuota   = 0
monto_pagado  = 0
fecha_pago    = fecha_vencimiento
```

Su monto original (antes de trasladarse a la cuota siguiente por `applyGracePeriods`, `@repo/core`) nunca se persiste en esta fila — ya quedó sumado a `monto_capital`/`monto_interes`/`monto_cuota` de la cuota con `numero = N+1` antes de que `issueLoan` llame a `emitir_prestamo` (research.md D1). No se necesita `CHECK` de "última cuota no puede ser gracia" en la base — se valida en `@repo/core` antes de construir el arreglo que se envía a `emitir_prestamo` (research.md D2).

## Cobro — columna nueva `abono_capital`

```sql
ALTER TABLE cobros ADD COLUMN abono_capital NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (abono_capital >= 0);
```

Hecho crudo, igual criterio que el resto de `cobros` (insert-only, nunca se actualiza). Representa cuánto de ESE evento de cobro específico excedió lo exigible de su propia cuota. Invariante (no impuesta por `CHECK` — cruzaría columnas de la misma fila con redondeo de por medio, igual criterio que `monto_capital + monto_interes` hoy):

```text
monto = monto_capital + monto_interes + abono_capital
```

En modo `reducir_plazo` (research.md D4), las cuotas futuras que se prepagan con el excedente generan sus PROPIAS filas de `cobros`, cada una con `abono_capital = 0` (son cobros normales de su propia cuota, ya fijada) — `abono_capital > 0` solo aparece en la fila del cobro que originó el excedente. En modo `reducir_cuota` (research.md D5) es la única fila que registra el abono; no se insertan filas adicionales.

## `configuracion_app` — columna nueva `modo_abono_capital`

```sql
ALTER TABLE configuracion_app
  ADD COLUMN modo_abono_capital TEXT NOT NULL DEFAULT 'reducir_plazo'
    CHECK (modo_abono_capital IN ('reducir_plazo', 'reducir_cuota'));
```

Mismo patrón que `moneda` (`specs/006-rebrand-currency-polish/`) — fila única, sin Vault, editable solo desde `apps/web`/Configuración (research.md D6).

## `emitir_prestamo` — mismo procedimiento, `p_cuotas` JSONB extendido

Firma sin cambios (`emitir_prestamo(UUID, NUMERIC, NUMERIC, estrategia_interes, INTEGER, frecuencia_pago, DATE, JSONB)`) — cada elemento de `p_cuotas` gana una clave opcional `es_gracia` (default `false` si no viene, para no romper ninguna llamada existente):

```sql
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
    -- Una cuota de gracia se inserta en $0 — su monto original ya fue trasladado a la
    -- cuota siguiente por applyGracePeriods (@repo/core) antes de llegar aquí (D1/D8).
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
```

No requiere `GRANT`/`REVOKE` nuevo — la firma es idéntica a la ya autorizada en `0007_auth_rls.sql`.

## `registrar_cobro` — mismo procedimiento, ya no rechaza el excedente

Firma sin cambios (`registrar_cobro(UUID, NUMERIC)`). En vez de `RAISE EXCEPTION 'MONTO_INVALIDO'` cuando `p_monto > saldo_restante`, cubre la cuota actual y distribuye el excedente según `configuracion_app.modo_abono_capital` (research.md D4/D5), en la MISMA transacción:

```sql
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
  SELECT * INTO v_cuota FROM cuotas WHERE id = p_cuota_id AND estado IN ('pendiente', 'parcial') FOR UPDATE;
  IF v_cuota.id IS NULL THEN
    RAISE EXCEPTION 'CUOTA_YA_PAGADA_O_INEXISTENTE' USING ERRCODE = 'P0001';
  END IF;
  v_prestamo_id := v_cuota.prestamo_id;

  v_saldo_restante := v_cuota.monto_cuota - COALESCE(v_cuota.monto_pagado, 0);
  v_monto_aplicado := LEAST(COALESCE(p_monto, v_saldo_restante), v_saldo_restante);
  v_excedente := GREATEST(COALESCE(p_monto, v_saldo_restante) - v_saldo_restante, 0);

  IF COALESCE(p_monto, v_saldo_restante) <= 0 THEN
    RAISE EXCEPTION 'MONTO_INVALIDO' USING ERRCODE = 'P0002';
  END IF;

  -- Paga la cuota actual (idéntico a 0004_pagos_parciales.sql — reparto proporcional FR-009).
  v_capital_aplicado := ROUND(v_monto_aplicado * v_cuota.monto_capital / v_cuota.monto_cuota, 2);
  v_interes_aplicado := v_monto_aplicado - v_capital_aplicado;

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

  -- ── Excedente → abono a capital (research.md D4/D5) ──────────────────────────
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
```

`aplicar_abono_reducir_plazo`/`aplicar_abono_reducir_cuota` son funciones auxiliares `LANGUAGE plpgsql` privadas (mismo archivo de migración, sin exponerse vía PostgREST — solo las llama `registrar_cobro` desde dentro de Postgres).

### `aplicar_abono_reducir_plazo` (research.md D4 — prepaga cuotas futuras completas)

```sql
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

  -- Si ya no queda ninguna cuota pendiente/parcial, el préstamo quedó saldado por completo
  -- (mismo criterio que liquidar_prestamo) — sin importar si sobró excedente sin aplicar
  -- (no debería ocurrir si la UI valida contra el saldo total antes de confirmar).
  SELECT COUNT(*) INTO v_quedan_pendientes FROM cuotas
  WHERE prestamo_id = p_prestamo_id AND estado IN ('pendiente', 'parcial');

  IF v_quedan_pendientes = 0 THEN
    UPDATE prestamos SET estado = 'liquidado' WHERE id = p_prestamo_id AND estado = 'activo';
  END IF;
END;
$$;
```

### `aplicar_abono_reducir_cuota` (research.md D5 — reduce capital futuro, nunca el interés)

```sql
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
  -- agregado (bug real encontrado al verificar contra la base local: "FOR UPDATE is not allowed
  -- with aggregate functions"), así que el bloqueo y el cálculo del capital pendiente van en
  -- pasadas separadas — el bloqueo ya tomado protege la consistencia entre ambas.
  PERFORM 1 FROM cuotas
  WHERE prestamo_id = p_prestamo_id AND estado IN ('pendiente', 'parcial')
  FOR UPDATE;

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

  -- Nunca negativo — si el excedente supera el capital restante, el capital futuro llega a
  -- $0 pero el interés de cada cuota NUNCA se toca (research.md D5, consecuencia documentada).
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
```

No requiere `GRANT`/`REVOKE` nuevo sobre `registrar_cobro` — firma idéntica a la ya autorizada en `0007_auth_rls.sql`. Las dos funciones auxiliares, por defensa en profundidad contra el mismo hallazgo de spec 007 T028 (Postgres otorga `EXECUTE` a `PUBLIC` por defecto en toda función nueva), también llevan:

```sql
REVOKE EXECUTE ON FUNCTION aplicar_abono_reducir_plazo(UUID, NUMERIC) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION aplicar_abono_reducir_cuota(UUID, NUMERIC) FROM PUBLIC, anon;
```

## `cliente_score` — misma vista, excluye cuotas de gracia (research.md D7)

```sql
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
```

Columnas de salida idénticas a la definición actual — `CREATE OR REPLACE VIEW` alcanza, no requiere `DROP` (a diferencia de `0004_pagos_parciales.sql`, que sí necesitó `DROP` porque cambiaba el tipo de una columna de la que dependía).

## Vistas/repositorios que **no** cambian (y por qué)

- **`cartera_resumen`, `cartera_tendencia_mensual`**: siguen sumando `cobros.monto`/`cobros.monto_interes` — `monto` ya incluye el excedente (`monto = monto_capital + monto_interes + abono_capital`), así que "total recuperado" refleja correctamente el dinero físico recibido sin ningún ajuste. Las cuotas de gracia nunca generan fila en `cobros` (se insertan `pagado` directo en `emitir_prestamo`, no vía `registrar_cobro`), así que tampoco las infla.
- **`idx_cuotas_pendientes`, `listCollectionRoute`**: filtran por `estado IN ('pendiente','parcial')` — una cuota de gracia (`estado='pagado'`) desaparece de mora/cobranza sin ningún ajuste (research.md D8).
- **`liquidar_prestamo`**: sin cambios — sigue pagando cuotas `pendiente`/`parcial` por su saldo restante exacto; ya es compatible con cuotas cuyo `monto_cuota` fue reducido por un abono en modo `reducir_cuota` (usa el valor de columna vigente, no uno recalculado aparte).

## Migración nueva

`supabase/migrations/0008_flexible_repayment.sql` — en este orden: (1) `ALTER TABLE cuotas ADD COLUMN es_gracia`, (2) `ALTER TABLE cobros ADD COLUMN abono_capital`, (3) `ALTER TABLE configuracion_app ADD COLUMN modo_abono_capital`, (4) `CREATE OR REPLACE FUNCTION emitir_prestamo` (extendida), (5) `CREATE FUNCTION aplicar_abono_reducir_plazo`/`aplicar_abono_reducir_cuota` (auxiliares, algoritmos D4/D5), (6) `CREATE OR REPLACE FUNCTION registrar_cobro` (extendida), (7) `CREATE OR REPLACE VIEW cliente_score` (excluye gracia). No toca `clientes`, `prestamos`, `liquidar_prestamo`, `cartera_resumen`, `cartera_tendencia_mensual`, RLS ni ningún `GRANT`/`REVOKE` — ver research.md D3 sobre por qué no hace falta.

## Entidades — resumen

- **Cliente, Préstamo**: sin cambios de forma.
- **Cuota**: gana `es_gracia` (fijo desde la estructuración, como `monto_capital`/`fecha_vencimiento`) — una cuota de gracia nace `pagado`/$0.
- **Cobro**: gana `abono_capital` (hecho crudo, insert-only) — cuánto de ese evento de cobro excedió lo exigible de su propia cuota.
- **Configuración de instalación**: gana `modo_abono_capital` (`'reducir_plazo' | 'reducir_cuota'`), mismo patrón que `moneda`.
- **Certificado de Paz y Salvo**: NO es una entidad de base de datos — ver `contracts/core-interfaces.md` (`PayoffCertificateData`, construida en memoria a partir de `Loan`/`Client` ya cargados).
