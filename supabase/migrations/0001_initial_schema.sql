-- Esquema inicial: clientes, prestamos, cuotas + vista derivada cliente_score.
-- Copiado tal cual de spec.md (raíz del repo) §4 — no modificar campos ni tipos aquí;
-- cualquier cambio de esquema se decide primero en spec.md raíz, luego en una nueva migración.

-- ── Clientes ────────────────────────────────────────────────────────────
CREATE TABLE clientes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre          TEXT NOT NULL,
  telefono        TEXT NOT NULL,
  direccion       TEXT,
  notas_privadas  TEXT,
  notas_actualizadas_en TIMESTAMPTZ,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Préstamos ───────────────────────────────────────────────────────────
CREATE TYPE frecuencia_pago    AS ENUM ('semanal', 'quincenal', 'mensual');
CREATE TYPE estado_prestamo    AS ENUM ('activo', 'liquidado', 'cancelado');
CREATE TYPE estrategia_interes AS ENUM ('simple_cuota_fija', 'frances'); -- abierto a más (OCP, ver spec.md raíz §7)

CREATE TABLE prestamos (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id     UUID NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
  capital        NUMERIC(12,2) NOT NULL CHECK (capital > 0),
  tasa_interes   NUMERIC(6,4)  NOT NULL CHECK (tasa_interes >= 0),   -- 0.1500 = 15%
  estrategia     estrategia_interes NOT NULL DEFAULT 'simple_cuota_fija',
  num_cuotas     INTEGER NOT NULL CHECK (num_cuotas > 0),
  frecuencia     frecuencia_pago NOT NULL,
  fecha_emision  DATE NOT NULL,
  estado         estado_prestamo NOT NULL DEFAULT 'activo',
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Cuotas ──────────────────────────────────────────────────────────────
CREATE TYPE estado_cuota AS ENUM ('pendiente', 'pagado'); -- 'vencido' es derivado, no se almacena

CREATE TABLE cuotas (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prestamo_id       UUID NOT NULL REFERENCES prestamos(id) ON DELETE CASCADE,
  numero            INTEGER NOT NULL,
  fecha_vencimiento DATE NOT NULL,
  monto_capital     NUMERIC(12,2) NOT NULL,
  monto_interes     NUMERIC(12,2) NOT NULL,
  monto_cuota       NUMERIC(12,2) NOT NULL,
  estado            estado_cuota NOT NULL DEFAULT 'pendiente',
  fecha_pago        TIMESTAMPTZ,
  monto_pagado      NUMERIC(12,2),
  UNIQUE (prestamo_id, numero)
);

CREATE INDEX idx_prestamos_cliente     ON prestamos(cliente_id);
CREATE INDEX idx_cuotas_prestamo       ON cuotas(prestamo_id);
CREATE INDEX idx_cuotas_pendientes     ON cuotas(fecha_vencimiento) WHERE estado = 'pendiente';

-- ── Vista derivada: score de confianza (ver mockup §2c) ───────────────────
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
