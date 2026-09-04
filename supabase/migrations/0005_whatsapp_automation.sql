-- Automatización WhatsApp (Fase 5 del negocio): recordatorios/alertas automáticas de cobro,
-- configuración de la conexión con Twilio, e historial. Ver specs/004-whatsapp-automation/
-- para el razonamiento completo de cada decisión (research.md, data-model.md, contracts/).

-- ── 1. Extensiones ──────────────────────────────────────────────────────────
-- supabase_vault ya viene instalada en la imagen de Supabase, no requiere CREATE EXTENSION.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ── 2. notificaciones_whatsapp: historial de recordatorios/alertas automáticas ─
-- Hecho crudo, igual que cobros — no derivable de otros datos (Principio IV). Como máximo
-- una fila por (cuota, tipo) en toda la vida de la cuota: nunca se reenvía la misma alerta
-- (research.md §5).
CREATE TABLE notificaciones_whatsapp (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cuota_id    UUID NOT NULL REFERENCES cuotas(id) ON DELETE CASCADE,
  cliente_id  UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  tipo        TEXT NOT NULL CHECK (tipo IN ('recordatorio', 'mora')),
  estado      TEXT NOT NULL CHECK (estado IN ('enviado', 'simulado', 'fallido')),
  detalle     TEXT,
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cuota_id, tipo)
);

CREATE INDEX idx_notificaciones_whatsapp_cliente ON notificaciones_whatsapp(cliente_id);

-- ── 3. estado_configuracion_whatsapp: único punto de lectura de la conexión ──
-- SECURITY DEFINER porque vault.decrypted_secrets no está concedida a anon/authenticated
-- (ni expuesta por PostgREST) — este puente nunca devuelve el SID ni el token, solo si están
-- los tres secretos presentes y el número de envío (no es secreto, es lo que ve el cliente).
CREATE OR REPLACE FUNCTION estado_configuracion_whatsapp()
RETURNS TABLE(conectado BOOLEAN, numero_desde TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_sid   TEXT;
  v_token TEXT;
  v_from  TEXT;
BEGIN
  SELECT decrypted_secret INTO v_sid   FROM vault.decrypted_secrets WHERE name = 'twilio_account_sid';
  SELECT decrypted_secret INTO v_token FROM vault.decrypted_secrets WHERE name = 'twilio_auth_token';
  SELECT decrypted_secret INTO v_from  FROM vault.decrypted_secrets WHERE name = 'twilio_whatsapp_from';

  IF v_sid IS NOT NULL AND btrim(v_sid) <> '' AND v_token IS NOT NULL AND btrim(v_token) <> ''
     AND v_from IS NOT NULL AND btrim(v_from) <> '' THEN
    RETURN QUERY SELECT true, v_from;
  ELSE
    RETURN QUERY SELECT false, NULL::TEXT;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION estado_configuracion_whatsapp() TO anon, authenticated;

-- ── 4. guardar_configuracion_whatsapp / borrar_configuracion_whatsapp ───────
CREATE OR REPLACE FUNCTION guardar_configuracion_whatsapp(p_account_sid TEXT, p_auth_token TEXT, p_numero_desde TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_existing_id UUID;
BEGIN
  IF p_account_sid IS NULL OR btrim(p_account_sid) = ''
     OR p_auth_token IS NULL OR btrim(p_auth_token) = ''
     OR p_numero_desde IS NULL OR btrim(p_numero_desde) = '' THEN
    RAISE EXCEPTION 'CREDENCIALES_INCOMPLETAS' USING ERRCODE = 'P0004';
  END IF;

  -- vault.create_secret/update_secret no hacen upsert por nombre — hay que resolver primero
  -- si cada secreto ya existe.
  SELECT id INTO v_existing_id FROM vault.decrypted_secrets WHERE name = 'twilio_account_sid';
  IF v_existing_id IS NOT NULL THEN PERFORM vault.update_secret(v_existing_id, p_account_sid);
  ELSE PERFORM vault.create_secret(p_account_sid, 'twilio_account_sid', 'Twilio Account SID'); END IF;

  SELECT id INTO v_existing_id FROM vault.decrypted_secrets WHERE name = 'twilio_auth_token';
  IF v_existing_id IS NOT NULL THEN PERFORM vault.update_secret(v_existing_id, p_auth_token);
  ELSE PERFORM vault.create_secret(p_auth_token, 'twilio_auth_token', 'Twilio Auth Token'); END IF;

  SELECT id INTO v_existing_id FROM vault.decrypted_secrets WHERE name = 'twilio_whatsapp_from';
  IF v_existing_id IS NOT NULL THEN PERFORM vault.update_secret(v_existing_id, p_numero_desde);
  ELSE PERFORM vault.create_secret(p_numero_desde, 'twilio_whatsapp_from', 'Número de envío de WhatsApp (Twilio), formato whatsapp:+E164'); END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION guardar_configuracion_whatsapp(TEXT, TEXT, TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION borrar_configuracion_whatsapp()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
BEGIN
  DELETE FROM vault.secrets WHERE name IN ('twilio_account_sid', 'twilio_auth_token', 'twilio_whatsapp_from');
END;
$$;

GRANT EXECUTE ON FUNCTION borrar_configuracion_whatsapp() TO anon, authenticated;

-- ── 5. revisar_y_enviar_notificaciones_whatsapp: el job en sí ───────────────
-- Elegibilidad 100% derivada (Principio IV) — nunca cacheada. "Próxima a vencer" = vence hoy
-- o mañana; "en mora" = ya venció y sigue pendiente/parcial. Misma semántica de
-- fecha_vencimiento/estado que ya usan cliente_score/idx_cuotas_pendientes (FR-011).
CREATE OR REPLACE FUNCTION revisar_y_enviar_notificaciones_whatsapp()
-- Nombres de columna de salida distintos de los de la tabla a propósito: "cuota_id"/"tipo" como
-- parámetro OUT chocaría con la lista de columnas de ON CONFLICT del INSERT de más abajo
-- (Postgres no permite calificar esa lista con el nombre de la tabla para desambiguar).
RETURNS TABLE(out_cuota_id UUID, out_tipo TEXT, out_resultado TEXT)
LANGUAGE plpgsql
AS $$
DECLARE
  v_conectado    BOOLEAN;
  v_numero_desde TEXT;
  v_sid          TEXT;
  v_token        TEXT;
  v_auth_header  TEXT;
  v_row          RECORD;
  v_mensaje      TEXT;
  v_telefono     TEXT;
  v_request_id   BIGINT;
  v_collect      net.http_response_result;
  v_estado       TEXT;
  v_detalle      TEXT;
  v_notif_id     UUID;
BEGIN
  -- Evita que dos corridas se pisen (el cron diario solapándose con una verificación manual,
  -- o dos disparos del cron si uno quedó colgado) — sin esto, ambas podrían pasar la
  -- comprobación de elegibilidad antes de que cualquiera alcance a reclamar la fila, y las dos
  -- terminarían enviando el mismo WhatsApp real (supabase-postgres-best-practices,
  -- lock-advisory). Se libera solo al terminar la transacción (la llamada completa a esta
  -- función), no hace falta desbloquear a mano.
  IF NOT pg_try_advisory_xact_lock(hashtext('whatsapp_cobros_review')) THEN
    RETURN;
  END IF;

  SELECT ecw.conectado, ecw.numero_desde INTO v_conectado, v_numero_desde FROM estado_configuracion_whatsapp() ecw;

  IF v_conectado THEN
    SELECT decrypted_secret INTO v_sid   FROM vault.decrypted_secrets WHERE name = 'twilio_account_sid';
    SELECT decrypted_secret INTO v_token FROM vault.decrypted_secrets WHERE name = 'twilio_auth_token';
    v_auth_header := 'Basic ' || encode(convert_to(v_sid || ':' || v_token, 'utf8'), 'base64');
  END IF;

  -- Ya no filtra por NOT EXISTS aquí — el INSERT ... ON CONFLICT DO NOTHING de más abajo es
  -- ahora el único punto de verdad de "¿ya se procesó esta cuota+tipo?", reclamado ANTES de
  -- enviar nada (ver nota debajo del loop).
  FOR v_row IN
    SELECT cu.id AS cid, cu.numero, cl.id AS clid, cl.nombre, cl.telefono, 'recordatorio'::text AS notif_tipo
    FROM cuotas cu
    JOIN prestamos p ON p.id = cu.prestamo_id
    JOIN clientes cl ON cl.id = p.cliente_id
    WHERE cu.estado IN ('pendiente', 'parcial')
      AND cu.fecha_vencimiento BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '1 day'

    UNION ALL

    SELECT cu.id, cu.numero, cl.id, cl.nombre, cl.telefono, 'mora'::text
    FROM cuotas cu
    JOIN prestamos p ON p.id = cu.prestamo_id
    JOIN clientes cl ON cl.id = p.cliente_id
    WHERE cu.estado IN ('pendiente', 'parcial')
      AND cu.fecha_vencimiento < CURRENT_DATE
  LOOP
    -- Normalización de teléfono (data-model.md): solo dígitos y un '+' inicial; inválido si el
    -- conteo de dígitos no está entre 8 y 15 — se omite sin generar fila ni error (FR-010).
    v_telefono := regexp_replace(v_row.telefono, '[^0-9+]', '', 'g');
    IF left(v_telefono, 1) <> '+' THEN
      v_telefono := '+' || regexp_replace(v_telefono, '[^0-9]', '', 'g');
    END IF;

    IF length(regexp_replace(v_telefono, '[^0-9]', '', 'g')) NOT BETWEEN 8 AND 15 THEN
      CONTINUE;
    END IF;

    -- Reclama la fila ANTES de enviar nada (supabase-postgres-best-practices, data-upsert):
    -- "verificar y luego insertar" es una condición de carrera — dos corridas concurrentes
    -- podrían ver ambas que la cuota no tiene notificación todavía y las dos enviarían un
    -- WhatsApp real antes de que el INSERT de cualquiera se ejecute. Reclamando primero (con
    -- un estado provisional) y actualizando después, como mucho una corrida gana la fila; la
    -- otra ve NULL en v_notif_id y pasa a la siguiente cuota sin haber llamado a Twilio.
    INSERT INTO notificaciones_whatsapp (cuota_id, cliente_id, tipo, estado)
    VALUES (v_row.cid, v_row.clid, v_row.notif_tipo, 'simulado')
    ON CONFLICT (cuota_id, tipo) DO NOTHING
    RETURNING id INTO v_notif_id;

    IF v_notif_id IS NULL THEN
      CONTINUE; -- ya reclamada por una corrida anterior (o esta misma cuota ya fue notificada)
    END IF;

    v_mensaje := CASE v_row.notif_tipo
      WHEN 'recordatorio' THEN format('Hola %s, te recordamos que tu cuota #%s vence pronto. ¡Gracias por tu puntualidad!', v_row.nombre, v_row.numero)
      ELSE format('Hola %s, tu cuota #%s está vencida. Por favor comunicate para regularizar tu pago.', v_row.nombre, v_row.numero)
    END;

    IF v_conectado THEN
      v_request_id := net.http_post(
        url := 'https://api.twilio.com/2010-04-01/Accounts/' || v_sid || '/Messages.json',
        params := jsonb_build_object('To', 'whatsapp:' || v_telefono, 'From', v_numero_desde, 'Body', v_mensaje),
        headers := jsonb_build_object('Authorization', v_auth_header),
        timeout_milliseconds := 10000
      );

      v_collect := net.http_collect_response(v_request_id, false);

      IF v_collect.status = 'SUCCESS' AND v_collect.response.status_code BETWEEN 200 AND 299 THEN
        v_estado := 'enviado';
        v_detalle := NULL;
      ELSE
        v_estado := 'fallido';
        v_detalle := COALESCE(v_collect.response.body, v_collect.message, 'sin detalle');
      END IF;

      UPDATE notificaciones_whatsapp SET estado = v_estado, detalle = v_detalle WHERE id = v_notif_id;
    ELSE
      v_estado := 'simulado'; -- ya quedó así desde el INSERT, no hace falta un UPDATE aparte
    END IF;

    out_cuota_id := v_row.cid;
    out_tipo := v_row.notif_tipo;
    out_resultado := v_estado;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- Sin GRANT a anon/authenticated a propósito: el disparo es automático (FR-003), no hay botón
-- en la UI que lo invoque manualmente. Se ejecuta como el rol que corrió esta migración
-- (postgres) tanto vía cron.schedule como en verificación manual directa.

-- ── 6. Job diario ────────────────────────────────────────────────────────────
-- Horario de arranque razonable (9:00 UTC) — ajustable con cron.alter_job sin migración nueva
-- (plan.md, Constraints).
SELECT cron.schedule(
  'whatsapp-cobros-diario',
  '0 9 * * *',
  $$SELECT revisar_y_enviar_notificaciones_whatsapp();$$
);
