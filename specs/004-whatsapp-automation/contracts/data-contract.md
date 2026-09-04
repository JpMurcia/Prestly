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

Sin `SECURITY DEFINER` (a diferencia de las 3 funciones de arriba) — nunca la llama el rol `anon`, solo `postgres` (vía `cron.schedule` o verificación manual), así que no hace falta escalar privilegios. Cuerpo (orden lógico, revisado tras auditar contra `supabase-postgres-best-practices` — ver research.md §8):

1. `pg_try_advisory_xact_lock(hashtext('whatsapp_cobros_review'))` — si ya hay otra corrida en curso, retorna de inmediato sin hacer nada.
2. Lee `estado_configuracion_whatsapp()`.
3. Selecciona cuotas elegibles para `'recordatorio'` y para `'mora'` (criterio en data-model.md), excluyendo clientes con teléfono no normalizable. Ya no filtra por `NOT EXISTS` — el paso 4 es ahora el único punto de verdad de "¿ya se procesó esta cuota+tipo?".
4. Por cada una, **reclama la fila primero**: `INSERT INTO notificaciones_whatsapp (cuota_id, cliente_id, tipo, estado) VALUES (..., 'simulado') ON CONFLICT (cuota_id, tipo) DO NOTHING RETURNING id`. Si no devuelve `id` (ya reclamada por una corrida anterior), pasa a la siguiente cuota sin llamar a Twilio.
5. Solo si la reclamó: si `conectado = true`, construye el mensaje, llama a `net.http_post` con los parámetros de Twilio en `params` (no en `body` — ver research.md §3), espera la respuesta con `net.http_collect_response(..., async := false)`, decide `'enviado'` (2xx) o `'fallido'` (cualquier otro código, guarda el cuerpo de la respuesta en `detalle`), y actualiza esa fila (`UPDATE ... WHERE id = ...`) con el resultado real. Si `conectado = false`, la fila ya quedó en `'simulado'` desde el paso 4, no hace falta un `UPDATE` aparte.
6. Devuelve una fila por cada cuota efectivamente reclamada y procesada en esta corrida (para que la prueba de verificación pueda confirmar el resultado sin tener que consultar la tabla aparte).

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
