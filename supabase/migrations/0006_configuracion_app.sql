-- Configuración global de la instalación (specs/006-rebrand-currency-polish/).
-- Tabla singleton (una sola fila, id fijo) — no es un secreto, así que a diferencia de la
-- configuración de WhatsApp (0005_whatsapp_automation.sql, Supabase Vault + funciones
-- SECURITY DEFINER) esta tabla se lee/escribe directo por supabase-js, sin RPC, mismo nivel
-- de acceso abierto que clientes/prestamos/cuotas (sin RLS en todo este proyecto — data-contract.md).

CREATE TABLE configuracion_app (
  id             SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  moneda         TEXT NOT NULL DEFAULT 'COP' CHECK (moneda IN ('COP', 'USD', 'MXN')),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO configuracion_app (id, moneda) VALUES (1, 'COP');
