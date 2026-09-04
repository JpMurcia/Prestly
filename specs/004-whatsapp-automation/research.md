# Research: Automatización WhatsApp

## 1. Mecanismo de disparo automático (FR-003)

**Decision**: `pg_cron` programa un job diario que llama directamente a una función PL/pgSQL (`revisar_y_enviar_notificaciones_whatsapp()`); esa función usa `pg_net` para llamar a la API de Twilio por HTTP. No se introducen Supabase Edge Functions en esta fase.

**Rationale**: Confirmado en la base local (`docker exec supabase_db_Prestly psql`) que `pg_cron` (1.6.4) y `pg_net` (0.20.4) están disponibles en la imagen de Supabase, solo falta `CREATE EXTENSION`. Ninguna fase anterior usa Edge Functions — todas las operaciones sensibles (`registrar_cobro`, `liquidar_prestamo`) son funciones PL/pgSQL invocadas por RPC. Mantener el mismo patrón evita introducir un runtime nuevo (Deno) y su mecánica de import de un paquete del monorepo, y sigue siendo verificable con las mismas herramientas ya probadas esta sesión (`docker exec ... psql`, scripts Node desechables). El documento de negocio nombra "Edge Functions" como mecanismo orientativo, no como restricción de la constitución (que no la menciona) — Principio V (YAGNI) pesa a favor de no añadir esa infraestructura hasta que haga falta.

**Alternatives considered**: Edge Function (`supabase/functions/whatsapp-cobros/`) invocada por `pg_net` desde `pg_cron` — más fiel a la redacción literal del roadmap, pero añade una superficie nueva (deploy, runtime Deno, resolución de red contenedor-a-contenedor sin verificar) sin necesidad real, dado que nada de esta fase es cálculo financiero que deba vivir en `@repo/core` (Principio II no aplica: decidir "¿esta cuota vence pronto?" es una comparación de fechas, no una fórmula de interés).

## 2. Almacenamiento de credenciales de Twilio (FR-004/FR-005)

**Decision**: `supabase_vault` (ya instalado, confirmado con `\df vault.*`) guarda 3 secretos con nombres fijos (`twilio_account_sid`, `twilio_auth_token`, `twilio_whatsapp_from`). Dos funciones `SECURITY DEFINER` en `public` (propietario `postgres`) son el único puente entre el rol `anon` (el que usa apps/web) y `vault`: `guardar_configuracion_whatsapp(p_account_sid, p_auth_token, p_numero_desde)` (upsert vía `vault.create_secret`/`vault.update_secret`) y `estado_configuracion_whatsapp()` (lee `vault.decrypted_secrets`, devuelve `conectado boolean` y el número de envío — nunca el SID ni el token).

**Rationale**: `vault.decrypted_secrets` no está expuesta a `anon`/`authenticated` por diseño de Supabase, y el esquema `vault` no se publica por PostgREST — sin este puente, guardar el token en una tabla normal (aunque sea de solo lectura para el administrador) sería legible por cualquiera que tenga la anon key (ya pública en el bundle de la web), a diferencia del resto de los datos de este sistema single-tenant que no son credenciales de un servicio de terceros con costo/abuso asociado. `SECURITY DEFINER` es el mismo mecanismo de "escalar privilegio para una operación puntual y auditable" que ya se usa implícitamente en las funciones de cobro.

**Alternatives considered**: Tabla `configuracion_whatsapp` en `public` con RLS sin políticas para `anon` — funciona, pero reinventa lo que Vault ya resuelve (cifrado en reposo, rotación) sin ganar nada; se descarta.

## 3. Llamada HTTP a Twilio desde `pg_net` (FR-006)

**Decision**: La API de mensajes de Twilio (`POST https://api.twilio.com/2010-04-01/Accounts/{Sid}/Messages.json`) exige `application/x-www-form-urlencoded`. `net.http_post(url, body jsonb, params jsonb, headers jsonb, timeout_ms)` serializa `body` como JSON — no sirve para form-encoding. En su lugar, los parámetros de Twilio (`To`, `From`, `Body`) se pasan por `params` (query string), que `pg_net` sí codifica como pares `clave=valor` (confirmado que existe `net._encode_url_with_params_array` internamente); la autenticación va en el header `Authorization: Basic <base64(sid:token)>` construido con `encode(convert_to(sid || ':' || token, 'utf8'), 'base64')`.

**Rationale**: Es el único camino confirmado por la firma real de `net.http_post` en la versión instalada (0.20.4) sin depender de que Twilio acepte JSON (no lo hace para este endpoint).

**Verificación pendiente**: Que Twilio efectivamente lea parámetros de un POST vía query string (comportamiento típico de su stack, pero no confirmado contra la Sandbox real todavía) — es la primera prueba a correr en cuanto el usuario comparta las credenciales de la Sandbox; si Twilio los rechaza, el plan B es construir el body como un string form-encoded y pasarlo como escalar de texto envuelto en `to_jsonb()`, ajustando `headers` para que el content-type coincida con lo que `pg_net` realmente envía.

`pg_net` es asíncrono (`http_post` devuelve un `request_id`, la respuesta llega a `net._http_response`). La función de envío hace un `net.http_collect_response(request_id, async := false)` (bloqueante, con el `timeout_milliseconds` del propio `http_post` como cota) para obtener el código de estado real antes de decidir si la notificación queda "enviado" o "fallido" — evita el caso de marcar como enviado algo que Twilio rechazó.

## 4. Verificación con cuenta real

**Decision**: Twilio WhatsApp Sandbox (decisión ya tomada con el usuario, ver spec.md Assumptions) — cuenta de prueba gratuita, sin aprobación de plantillas ni verificación de negocio, con un número compartido (`whatsapp:+14155238886` salvo que la cuenta del usuario indique otro) al que el destinatario debe unirse una vez enviando `join <código>` desde su propio WhatsApp antes de que la Sandbox le entregue mensajes.

**Rationale**: Es el mecanismo estándar de Twilio pensado exactamente para este caso (probar WhatsApp en desarrollo sin proceso de aprobación de Meta). Documentado en `quickstart.md` como prerrequisito de la Historia 1 (verificación real) — no bloquea la Historia 2 ni la 3, que no requieren una cuenta real para verificarse.

## 5. Idempotencia de notificaciones automáticas (FR-013)

**Decision**: Restricción `UNIQUE (cuota_id, tipo)` en `notificaciones_whatsapp` — una cuota recibe como máximo un recordatorio y como máximo una alerta de mora en toda su vida, nunca un reenvío diario mientras siga vencida. `revisar_y_enviar_notificaciones_whatsapp()` reclama la fila con `INSERT ... ON CONFLICT (cuota_id, tipo) DO NOTHING RETURNING id` **antes** de llamar a Twilio (no una comprobación `NOT EXISTS` seguida de un `INSERT` al final) — ver §8, es la parte que de verdad evita un envío real duplicado, no solo una fila duplicada.

**Rationale**: Simplifica la noción de "ventana vigente" de la spec a una regla verificable sin ambigüedad (Principio IV) y evita spam repetido al cliente, un resultado más razonable para un prestamista personal que reenviar la misma alerta cada día que pasa un job. Si el negocio pide más adelante un recordatorio recurrente en mora prolongada, es un cambio de esta única restricción, no un rediseño.

## 6. Acciones manuales de compartir (Historia 3)

**Decision**: Enlace `https://wa.me/<teléfono E.164 sin '+'>?text=<mensaje codificado>` construido enteramente en el cliente (mobile/web), sin backend. `@repo/core` gana funciones puras (`buildWhatsAppShareLink`, `buildLoanShareMessage`, `buildReceiptMessage`) para que el formato del enlace y la redacción del mensaje vivan en un solo lugar, igual que cualquier otra lógica compartida entre ambas apps.

**Rationale**: Es exactamente lo que el propio mockup describe ("acción, todavía no integración") — no requiere las credenciales de Twilio ni pasa por el flujo automático, así que la Historia 3 se verifica sin ninguna dependencia externa, real o simulada.

## 7. Reparto de responsabilidad DIP (FR-006, config e historial)

**Decision**: `@repo/core` define `IWhatsAppConfigRepository` (`getStatus`, `saveCredentials`) e `IWhatsAppNotificationHistoryReader` (`list`) — mismo patrón que `ILoanRepository`/`IPortfolioReader` de fases anteriores. `packages/data-supabase` los implementa llamando a las funciones RPC (`estado_configuracion_whatsapp`, `guardar_configuracion_whatsapp`) y leyendo la tabla `notificaciones_whatsapp` respectivamente. `apps/web` los consume para la Historia 2 y la parte de historial de la Historia 1; `apps/mobile` no necesita estas interfaces (la configuración y el historial son solo de apps/web, ver data-model.md).

**Rationale**: El envío automático en sí (dentro de la función PL/pgSQL programada) no pasa por TypeScript ni por `@repo/core` — no hay una clase JS "swappeable" ahí porque nada en JS orquesta ese envío. El patrón DIP de esta fase aplica genuinamente a la parte que sí consumen las apps (configurar y auditar), igual de real que en `ILoanRepository`, sin forzar una capa de indirección donde no hay un consumidor JS que la necesite.

## 8. Corrección de concurrencia en `revisar_y_enviar_notificaciones_whatsapp()` (hallazgo post-implementación)

**Hallazgo**: Revisando la migración contra el skill `supabase-postgres-best-practices` (no cargado antes de escribirla — debería haberse cargado, según sus propias instrucciones, para "creating or altering... database functions... scheduled jobs (pg_cron)") salieron dos problemas reales, no solo de estilo:

1. **Condición de carrera "verificar y luego insertar"** (`data-upsert.md`): la versión original filtraba las cuotas elegibles con `NOT EXISTS (SELECT 1 FROM notificaciones_whatsapp ...)`, enviaba el WhatsApp, y recién al final hacía `INSERT ... ON CONFLICT DO NOTHING`. Dos corridas concurrentes de esta función (el cron diario solapándose con una verificación manual, por ejemplo) podían pasar ambas la comprobación `NOT EXISTS` antes de que cualquiera insertara — la fila duplicada se evitaba, pero el **envío real a Twilio no**, porque ya había ocurrido antes del `INSERT`.
2. **Falta de una traba a nivel de corrida completa** (`lock-advisory.md`): nada impedía que dos invocaciones de la función corrieran a la vez para empezar.

**Decision**: `pg_try_advisory_xact_lock(hashtext('whatsapp_cobros_review'))` al inicio de la función (si no se consigue, retorna de inmediato — la próxima corrida ya se encarga) **más** reordenar cada cuota del loop para reclamar su fila con `INSERT ... ON CONFLICT (cuota_id, tipo) DO NOTHING RETURNING id` (estado provisional `'simulado'`) **antes** de tocar `net.http_post`; si `v_notif_id` sale `NULL` (ya reclamada), se salta esa cuota sin llamar a Twilio. Solo tras reclamarla se calcula el mensaje, se envía si corresponde, y se actualiza esa misma fila (`UPDATE ... WHERE id = v_notif_id`) con el resultado real.

**Rationale**: Es el patrón exacto que recomienda `data-upsert.md` ("Insert-or-ignore… Correct (atomic UPSERT)") adaptado a "reclamar antes de actuar" en vez de "leer antes de escribir" — la única forma de que como mucho una corrida efectivamente llame a Twilio por cada cuota+tipo, en vez de solo garantizar como mucho una fila en la tabla. El advisory lock es una segunda capa (evita trabajo repetido de dos corridas revisando la misma cartera a la vez), no la que resuelve la condición de carrera de fondo — esa la resuelve el reclamo atómico.

No se adoptó, por desproporcionado para el volumen y el riesgo real de esta app (single-tenant, un puñado de mensajes al día): convertir la función en un `PROCEDURE` con `COMMIT` por cada cuota para que un fallo a mitad de lote no revierta las notificaciones ya enviadas exitosamente en esa misma corrida (`lock-short-transactions.md` señala el problema de fondo — la función entera sigue siendo una única transacción implícita mientras espera cada respuesta HTTP). Documentado aquí como decisión consciente, no como algo pasado por alto: si el volumen de mensajes crece lo suficiente para que un fallo a mitad de lote sea una preocupación real, es el primer lugar a revisar.
