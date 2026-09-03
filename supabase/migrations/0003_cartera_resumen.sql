-- Resumen agregado de cartera para el dashboard de Admin Web (specs/002-admin-web/, US1).
-- Igual que `cliente_score` (0001_initial_schema.sql), es una vista derivada — nunca una
-- columna almacenada (constitución, Principio IV) — recalculada en cada lectura.

-- Dos subconsultas independientes, combinadas en una sola fila (CROSS JOIN de dos agregados
-- escalares): `capital_prestado` se calcula sobre `prestamos` sin pasar por el JOIN a `cuotas`
-- a propósito — sumarlo después de unir con `cuotas` duplicaría el capital de cada préstamo una
-- vez por cada una de sus cuotas (fan-out), inflando el total en un factor igual al número de
-- cuotas. Las demás métricas sí son valores por-cuota, así que sí pueden sumarse sobre el JOIN.
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
