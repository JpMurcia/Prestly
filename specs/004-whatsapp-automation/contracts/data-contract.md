# Contrato: Base de datos — Automatización WhatsApp

## Tabla `notificaciones_whatsapp`

Ver esquema completo en [data-model.md](../data-model.md). Lectura directa vía PostgREST (`SELECT`, sin `RPC`) — igual que `cuotas`/`cobros` en fases anteriores, sin RLS restrictiva (consistente con el resto del sistema single-tenant).

## Funciones RPC (`public`, invocadas por `apps/web` con la anon key vía `supabase.rpc(...)`)

### `guardar_configuracion_whatsapp(p_account_sid text, p_auth_token text, p_numero_desde text) RETURNS void`

`SECURITY DEFINER`. Upsert de los 3 secretos en Vault (`vault.create_secret` si no existen, `vault.update_secret` si ya existen — busca por `name` en `vault.decrypted_secrets` primero). Rechaza (excepción) si algún parámetro viene vacío.

### `borrar_configuracion_whatsapp() RETURNS void`

`SECURITY DEFINER`. Elimina los 3 secretos (`DELETE FROM vault.secrets WHERE name IN (...)`) — vuelve al estado "no configurado" (Historia 2, escenario 3).

### `estado_configuracion_whatsapp() RETURNS TABLE(conectado boolean, numero_desde text)`

`SECURITY DEFINER`. `conectado = true` solo si los 3 secretos existen y no están vacíos. `numero_desde` viene de `twilio_whatsapp_from` (se puede mostrar, no es secreto) — `NULL` si no está conectado.

### `revisar_y_enviar_notificaciones_whatsapp() RETURNS TABLE(cuota_id uuid, tipo text, resultado text)`

`SECURITY DEFINER`. Cuerpo (orden lógico):

1. Lee `estado_configuracion_whatsapp()`. Si `conectado = false`, cada notificación se registra con `estado = 'simulado'` sin llamar a `pg_net`.
2. Selecciona cuotas elegibles para `'recordatorio'` y para `'mora'` (criterio en data-model.md), excluyendo clientes con teléfono no normalizable y cuotas que ya tengan fila en `notificaciones_whatsapp` de ese `tipo`.
3. Por cada una, si `conectado = true`: construye el mensaje, llama a `net.http_post` con los parámetros de Twilio en `params` (no en `body` — ver research.md §3), espera la respuesta con `net.http_collect_response(..., async := false)`, y decide `'enviado'` (2xx) o `'fallido'` (cualquier otro código, guarda el cuerpo de la respuesta en `detalle`).
4. `INSERT INTO notificaciones_whatsapp (...) VALUES (...) ON CONFLICT (cuota_id, tipo) DO NOTHING` — idempotente aunque la función se llame dos veces seguidas.
5. Devuelve una fila por cada cuota procesada (para que la prueba de verificación pueda confirmar el resultado sin tener que consultar la tabla aparte).

Invocada tanto por el job de `pg_cron` (`SELECT revisar_y_enviar_notificaciones_whatsapp();`, sin leer el resultado) como directamente en verificación manual (`SELECT * FROM revisar_y_enviar_notificaciones_whatsapp();`).

## Job de `pg_cron`

```sql
SELECT cron.schedule(
  'whatsapp-cobros-diario',
  '0 9 * * *', -- todos los días 9:00 UTC; ajustable sin cambiar la función
  $$SELECT revisar_y_enviar_notificaciones_whatsapp();$$
);
```

El horario exacto no es observable por el usuario en esta fase (no hay huso horario de negocio definido) — se documenta como valor de arranque razonable, cambiable con `cron.alter_job` sin migración nueva si el negocio pide otro horario.

## Extensiones requeridas (migración `0005_whatsapp_automation.sql`)

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
-- supabase_vault ya viene instalada en la imagen de Supabase, no requiere CREATE EXTENSION.
```
