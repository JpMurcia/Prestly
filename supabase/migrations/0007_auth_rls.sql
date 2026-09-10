-- Autenticación del administrador (specs/007-admin-authentication/): cierra el hallazgo del
-- Security Advisor de Supabase (RLS Disabled in Public en las 6 tablas de negocio, Security
-- Definer View en las 3 vistas derivadas). A partir de esta migración, solo una sesión
-- `authenticated` real (Supabase Auth) puede leer o escribir — ver research.md §4-§6 para el
-- razonamiento completo de cada bloque.

-- ── 1. pgcrypto — necesaria para sembrar la cuenta de desarrollo en seed.sql (crypt/gen_salt) ──
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── 2. RLS en las 6 tablas de negocio — una sola policy, sin aislar por usuario ─────────────
-- Sigue existiendo un único administrador (spec.md raíz §1); no hay una segunda cuenta de la
-- que aislarse, así que la policy solo distingue "autenticado" de "sin sesión" (research.md §4).
-- Sin policy para `anon`: con RLS activo, el acceso se deniega por defecto para cualquier rol
-- sin una policy que lo cubra — es justamente lo que exige FR-003.

ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clientes_authenticated_all" ON clientes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE prestamos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prestamos_authenticated_all" ON prestamos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE cuotas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cuotas_authenticated_all" ON cuotas
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE cobros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cobros_authenticated_all" ON cobros
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE configuracion_app ENABLE ROW LEVEL SECURITY;
CREATE POLICY "configuracion_app_authenticated_all" ON configuracion_app
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE notificaciones_whatsapp ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notificaciones_whatsapp_authenticated_all" ON notificaciones_whatsapp
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── 3. Vistas derivadas — sin esto, la RLS de arriba no las cubre (research.md §5) ──────────
-- CREATE VIEW liso corre con los privilegios del dueño de la vista, no de quien consulta.
-- security_invoker=true hace que cada vista ejecute como el rol que la consulta, heredando
-- las policies de §2 automáticamente (FR-009).
ALTER VIEW cliente_score SET (security_invoker = true);
ALTER VIEW cartera_resumen SET (security_invoker = true);
ALTER VIEW cartera_tendencia_mensual SET (security_invoker = true);

-- ── 4. Funciones RPC — revocar EXECUTE de PUBLIC y de anon (research.md §6) ─────────────────
-- CORRECCIÓN (verificado end-to-end contra el stack local, dos rondas): Postgres otorga EXECUTE
-- a PUBLIC automáticamente al crear una función, salvo que se revoque explícitamente — ninguna
-- migración anterior lo hizo. Como `anon` es miembro implícito de PUBLIC, revocar solo de `anon`
-- no alcanzaba (`anon` seguía heredando EXECUTE vía PUBLIC); pero revocar solo de PUBLIC TAMPOCO
-- alcanza, porque 0002/0004/0005 además otorgaron EXECUTE a `anon` de forma directa
-- (`GRANT ... TO anon, authenticated`), un privilegio propio que no depende de PUBLIC. Hay que
-- revocar los dos. Confirmado con curl en ambas rondas: primero seguía ejecutándose vía PUBLIC,
-- después (ya revocado PUBLIC) seguía ejecutándose vía el GRANT directo a anon.
--
-- emitir_prestamo/registrar_cobro/liquidar_prestamo son SECURITY INVOKER (default): la RLS de
-- arriba ya las protegería solas una vez cerrados PUBLIC y anon, pero dejar cualquiera de los
-- dos GRANT produce un error confuso desde adentro de la función en vez de un rechazo limpio.
REVOKE EXECUTE ON FUNCTION emitir_prestamo(
  UUID, NUMERIC, NUMERIC, estrategia_interes, INTEGER, frecuencia_pago, DATE, JSONB
) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION registrar_cobro(UUID, NUMERIC) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION liquidar_prestamo(UUID) FROM PUBLIC, anon;

-- Estas 3 SÍ son SECURITY DEFINER (0005_whatsapp_automation.sql): corren con los privilegios
-- de quien las creó y por eso ignoran la RLS de arriba por completo. Sin este REVOKE, cualquiera
-- con la anon key podría seguir leyendo el estado de la conexión de WhatsApp, o peor,
-- sobrescribir/borrar las credenciales de Twilio, sin ninguna sesión — exactamente lo que se
-- reprodujo (dos veces, por las dos causas de arriba) antes de esta versión final.
REVOKE EXECUTE ON FUNCTION estado_configuracion_whatsapp() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION guardar_configuracion_whatsapp(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION borrar_configuracion_whatsapp() FROM PUBLIC, anon;

-- authenticated conserva su GRANT original (0002/0004/0005) — no se toca, es el único que debe
-- seguir teniendo EXECUTE.
