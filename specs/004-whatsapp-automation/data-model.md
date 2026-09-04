# Data Model: Automatización WhatsApp

## Configuración de WhatsApp (Vault, no es una tabla de `public`)

Tres secretos en `vault.secrets`, identificados por `name` fijo:

| `name`                  | Contenido                                              |
|--------------------------|--------------------------------------------------------|
| `twilio_account_sid`     | Account SID de Twilio                                  |
| `twilio_auth_token`      | Auth Token de Twilio                                   |
| `twilio_whatsapp_from`   | Número de envío en formato `whatsapp:+E164` (Sandbox: `whatsapp:+14155238886`) |

Nunca se exponen los tres juntos ni el token fuera de funciones `SECURITY DEFINER`. "Conectado" = existen los tres secretos.

## Notificación de cobro (`notificaciones_whatsapp`, tabla nueva)

| Columna     | Tipo          | Notas                                                              |
|-------------|---------------|---------------------------------------------------------------------|
| `id`        | uuid PK       | `gen_random_uuid()`                                                 |
| `cuota_id`  | uuid FK → `cuotas(id)` | `ON DELETE CASCADE`                                         |
| `cliente_id`| uuid FK → `clientes(id)` | `ON DELETE CASCADE` — denormalizado desde `cuotas→prestamos→clientes` para no requerir un join en la lectura del historial (Historia 1, escenario 5) |
| `tipo`      | text CHECK IN (`'recordatorio'`, `'mora'`) | |
| `estado`    | text CHECK IN (`'enviado'`, `'simulado'`, `'fallido'`) | `'simulado'` cuando no hay configuración conectada; `'fallido'` cuando Twilio devuelve un error (queda el detalle) |
| `detalle`   | text NULL     | Código/mensaje de error de Twilio cuando `estado = 'fallido'`       |
| `creado_en` | timestamptz DEFAULT `now()` | |

**Restricción**: `UNIQUE (cuota_id, tipo)` — como máximo un recordatorio y como máximo una alerta de mora por cuota en toda su vida (research.md §5). Un `INSERT ... ON CONFLICT (cuota_id, tipo) DO NOTHING` en la función de envío hace la idempotencia atómica sin necesidad de un `SELECT` previo.

**Elegibilidad** (evaluada por la función automática, no almacenada — Principio IV):

- Recordatorio: `cuotas.estado IN ('pendiente','parcial')` AND `cuotas.fecha_vencimiento` está entre hoy y "hoy + N días" (N configurable en la función, default 1 día — ver Assumptions de spec.md).
- Mora: `cuotas.estado IN ('pendiente','parcial')` AND `cuotas.fecha_vencimiento < hoy`.
- En ambos casos, excluye clientes cuyo `telefono` no normaliza a un número utilizable (ver más abajo) y cuotas que ya tengan una fila en `notificaciones_whatsapp` de ese `tipo`.

## Normalización de teléfono (regla compartida, implementada por separado en SQL y en `@repo/core`)

`clientes.telefono` es `text NOT NULL` pero sin validación de formato en las fases anteriores (se confirmó en datos reales locales: valores como `"555-0300"` conviven con números reales). Esta fase define la regla de "utilizable para WhatsApp" — **no se re-captura ni se corrige el dato existente**, solo se decide si se usa o se omite (FR-010):

> Quitar todo excepto dígitos y un `+` inicial opcional. Es "válido" si el resultado tiene entre 8 y 15 dígitos. Si no, se trata como inválido (se omite, no es un error).

Esta regla vive dos veces por necesidad de runtime (PL/pgSQL para la revisión automática, TypeScript en `@repo/core` para los botones manuales — Historia 3), no por elección — research.md §6/§7 documenta por qué el envío automático no comparte código JS con las apps. Ambas implementaciones se prueban contra la misma tabla de casos (script de verificación, no un archivo compartido).

## Entidades reutilizadas (sin cambios de esquema)

- **Cliente**: se lee `telefono` (para elegibilidad y para el enlace `wa.me`) y `nombre` (para el mensaje). No gana columnas nuevas.
- **Cuota / Préstamo**: se leen para decidir elegibilidad (recordatorio/mora) y para componer los mensajes (monto, número de cuota, saldo). No ganan columnas nuevas — la Configuración y el Historial son las únicas entidades nuevas de esta fase.

## Diagrama de relaciones (nuevo)

```
clientes 1──* prestamos 1──* cuotas 1──0..2 notificaciones_whatsapp
                                              (0..1 'recordatorio' + 0..1 'mora', por UNIQUE(cuota_id, tipo))

vault.secrets (3 filas de nombre fijo) ── leídas solo por funciones SECURITY DEFINER
```
