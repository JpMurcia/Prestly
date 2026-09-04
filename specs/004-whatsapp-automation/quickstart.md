# Quickstart: Automatización WhatsApp

## Prerrequisitos

- Supabase local corriendo (`npx supabase status`) con la migración `0005_whatsapp_automation.sql` aplicada (`npx supabase db reset` o `npx supabase migration up`).
- `npm install && npm run build --workspace=@repo/core --workspace=@repo/data-supabase`.
- Para verificar el envío REAL (parte de la Historia 1): una cuenta de Twilio con la WhatsApp Sandbox activada —
  1. Crear cuenta gratis en [twilio.com](https://www.twilio.com/try-twilio).
  2. En la Consola: Messaging → Try it out → Send a WhatsApp message. Anotar el número de Sandbox (normalmente `+14155238886`) y el código de unión (`join <palabra-palabra>`).
  3. Desde tu propio WhatsApp, enviar `join <código>` a ese número — sin este paso Twilio rechaza los mensajes hacia tu número.
  4. Copiar el **Account SID** y el **Auth Token** de la página principal de la Consola.
- Sin estos datos, la Historia 1 se verifica igual pero solo en modo simulado (`estado = 'simulado'`); la Historia 2 y la Historia 3 no dependen de esto en absoluto.

## Historia 2 — Configurar la conexión (aislado, sin datos de préstamos)

```sql
-- Estado inicial: no configurado
select * from estado_configuracion_whatsapp(); -- conectado = false, numero_desde = null

select guardar_configuracion_whatsapp('ACxxxx...', 'authtoken...', 'whatsapp:+14155238886');
select * from estado_configuracion_whatsapp(); -- conectado = true, numero_desde = 'whatsapp:+14155238886'

select borrar_configuracion_whatsapp();
select * from estado_configuracion_whatsapp(); -- conectado = false otra vez
```

Desde la UI (apps/web): pantalla de configuración → guardar credenciales → recargar página → debe seguir mostrando "conectado" (persistencia real, no solo estado de React).

## Historia 1 — Recordatorios y alertas automáticas

1. Sembrar datos: un préstamo con una cuota que vence mañana (elegible a "recordatorio") y otro con una cuota vencida hace 3 días (elegible a "mora"), ambos con un `telefono` normalizable — ver [data-model.md](data-model.md) para el criterio de elegibilidad y la regla de normalización.
2. **Modo simulado** (sin `guardar_configuracion_whatsapp` aplicado): `select * from revisar_y_enviar_notificaciones_whatsapp();` → cada fila devuelta con `resultado = 'simulado'`; confirmar en `notificaciones_whatsapp` que quedaron los registros con `estado = 'simulado'`.
3. **Idempotencia**: correr `revisar_y_enviar_notificaciones_whatsapp()` una segunda vez sin cambiar datos → 0 filas nuevas en `notificaciones_whatsapp` (la restricción `UNIQUE (cuota_id, tipo)` lo garantiza).
4. **Modo real** (con las credenciales de Twilio Sandbox del prerrequisito, después de unir tu número): `guardar_configuracion_whatsapp(...)` con los datos reales, sembrar una nueva cuota elegible (para no chocar con el `UNIQUE` del paso 2), correr `revisar_y_enviar_notificaciones_whatsapp()` de nuevo → verificar que llega un WhatsApp de verdad al número unido a la Sandbox, y que la fila en `notificaciones_whatsapp` quedó con `estado = 'enviado'`.
5. **Cliente sin teléfono válido**: sembrar una cuota elegible cuyo cliente tenga un `telefono` que no normaliza (ej. `"n/a"`) → no debe aparecer en el resultado de `revisar_y_enviar_notificaciones_whatsapp()` ni generar fila alguna.
6. Desde la UI (apps/web): abrir el historial de notificaciones → deben verse las filas generadas en los pasos anteriores con su tipo y resultado.

## Historia 3 — Compartir por WhatsApp con un toque

1. Emitir un préstamo para un cliente con teléfono normalizable (móvil o web) → tocar "Compartir tabla por WhatsApp" → confirmar que se abre `wa.me` (o el selector de apps) con el número correcto y el mensaje ya redactado (monto, cuotas, primer vencimiento).
2. Registrar un cobro (total o parcial) → tocar "Enviar comprobante por WhatsApp" → confirmar el mensaje (monto recibido, cuota, saldo si quedó parcial).
3. Repetir 1 o 2 con un cliente cuyo teléfono no normalice → el botón debe aparecer deshabilitado con el motivo indicado, no debe intentar abrir nada.

No requiere Supabase Vault, Twilio, ni `pg_cron` — verificable incluso con la conexión de WhatsApp en estado "no configurado".

## Verificación de punta a punta esperada

Todas las historias verificadas contra la base local recién reseteada (`npx supabase db reset`), igual que en `specs/001-mobile-field-app/`, `specs/002-admin-web/` y `specs/003-operational-management/`. La Historia 1 debe verificarse en ambos modos (simulado y real) antes de dar la fase por entregada — ver Assumptions de [spec.md](spec.md).
