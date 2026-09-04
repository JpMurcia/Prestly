# Feature Specification: Automatización WhatsApp — Recordatorios, Comprobantes y Configuración de la API

**Feature Branch**: `004-whatsapp-automation`

**Created**: 2026-09-03

**Status**: Draft

**Input**: User description: "Automatización WhatsApp (Fase 5 del roadmap de negocio en spec.md raíz, tabla \"Hoja de Ruta y Fases de Ejecución\" de Docs/Plan_Negocio_Microcreditos.docx: \"Integración de Twilio/Meta API en Supabase Edge Functions para alertas de cobro automatizadas vía WhatsApp\"): notificaciones automáticas de cobro (recordatorio antes del vencimiento de una cuota, alerta de mora tras vencer) disparadas desde Supabase sin intervención manual del administrador, más las dos acciones manuales que los mockups (Docs/Plataforma Mockus/Microcreditos - Mockups.dc.html) ya dibujan como botones — \"Compartir tabla por WhatsApp\" tras emitir un préstamo y \"Enviar comprobante por WhatsApp\" tras registrar un cobro — que ninguna spec anterior implementó (el propio mockup aclara en su sección de supuestos: \"WhatsApp aparece como acción, todavía no como integración\"). Disponible tanto en apps/mobile como en apps/web reutilizando @repo/core (nueva interfaz de notificación siguiendo DIP, igual patrón que ILoanRepository) y el mismo esquema Supabase que las fases anteriores; incluye una pantalla de configuración de la API de WhatsApp en apps/web (mencionada en §2.2 del plan de negocio: \"futura configuración de la API de WhatsApp\"). Este es un entorno de desarrollo local sin cuenta real de Twilio/Meta todavía, así que la implementación debe quedar detrás de una interfaz intercambiable (Principio V de la constitución / OCP) que permita verificar el flujo de punta a punta sin credenciales reales de WhatsApp. Fuera de alcance: conversaciones bidireccionales o webhooks de mensajes entrantes, y cualquier fase posterior a la 5 (no existe ninguna en el roadmap del negocio)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Recibir recordatorios y alertas automáticas de cobro por WhatsApp (Priority: P1)

Como prestamista, quiero que mis clientes reciban automáticamente un recordatorio por WhatsApp antes de que venza su cuota y una alerta cuando ya esté vencida, sin tener que acordarme de escribirle a cada uno manualmente, para reducir la mora sin que la cobranza dependa de mi memoria.

**Why this priority**: Es el entregable que el propio roadmap de negocio nombra explícitamente para esta fase ("alertas de cobro automatizadas vía WhatsApp") y el que más valor de negocio aporta — cobranza proactiva sin trabajo manual repetitivo. Sin esto, la Fase 5 no está completa aunque existan las acciones manuales de compartir.

**Independent Test**: Con una cuota que vence mañana y otra que ya venció hace 3 días, disparar la revisión de notificaciones y verificar que se genera (real o simuladamente, según configuración) un mensaje de recordatorio para la primera y uno de alerta de mora para la segunda, cada uno visible en el historial de notificaciones — se puede probar de punta a punta sin depender de las otras historias ni de una cuenta real de WhatsApp.

**Acceptance Scenarios**:

1. **Given** una cuota pendiente próxima a vencer, **When** llega el momento de la revisión automática, **Then** el sistema prepara y envía (o simula, si no hay conexión real configurada) un mensaje de recordatorio al cliente de esa cuota, sin que el administrador lo redacte ni lo dispare manualmente cuota por cuota.
2. **Given** una cuota pendiente o parcial ya vencida, **When** llega el momento de la revisión automática, **Then** el sistema prepara y envía (o simula) un mensaje de alerta de mora, distinto en contenido al recordatorio previo al vencimiento.
3. **Given** una cuota que ya fue pagada por completo antes de la revisión, **When** el sistema revisa qué cuotas necesitan notificación, **Then** esa cuota no genera ningún recordatorio ni alerta.
4. **Given** una cuota que ya recibió un recordatorio o una alerta de mora en la revisión anterior, **When** el sistema vuelve a revisar sin que haya cambiado su condición, **Then** no se envía una segunda notificación duplicada del mismo tipo para esa cuota.
5. **Given** el historial de notificaciones, **When** el administrador lo revisa, **Then** puede confirmar para cualquier cuota si ya se le envió un recordatorio o una alerta de mora, y cuándo.

---

### User Story 2 - Configurar la conexión con la API de WhatsApp (Priority: P1)

Como prestamista, quiero poder ingresar y guardar desde la web las credenciales de mi proveedor de WhatsApp (Twilio), y ver claramente si la conexión está activa, para controlar cuándo mis clientes empiezan a recibir mensajes reales.

**Why this priority**: Es el habilitador explícito nombrado en el plan de negocio (§2.2, "futura configuración de la API de WhatsApp") y la única forma de que la Historia 1 deje de ser una simulación y empiece a enviar mensajes reales — sin esta pantalla, activar el envío real no tiene ninguna vía en el producto.

**Independent Test**: Ingresar credenciales de prueba en la pantalla de configuración, guardarlas, y verificar que la pantalla muestra el estado "conectado" sin volver a mostrar la credencial completa; luego borrarlas y verificar que el estado vuelve a "no configurado" — se puede probar de forma aislada, sin depender de un envío real ni de las otras historias.

**Acceptance Scenarios**:

1. **Given** que no hay ninguna conexión de WhatsApp configurada, **When** abro la pantalla de configuración, **Then** veo claramente el estado "no configurado" y un formulario para ingresar las credenciales del proveedor elegido.
2. **Given** que ingreso credenciales y las guardo, **When** vuelvo a abrir la pantalla (incluso tras recargar), **Then** veo el estado "conectado" y la credencial guardada no se muestra completa en pantalla.
3. **Given** una conexión ya configurada, **When** elijo desconectarla, **Then** el estado vuelve a "no configurado" y los envíos automáticos posteriores quedan en modo simulado hasta reconfigurarla.

---

### User Story 3 - Compartir por WhatsApp con un toque (Priority: P2)

Como prestamista o cobrador en campo, quiero compartir por WhatsApp la tabla de amortización justo después de emitir un préstamo, y el comprobante justo después de registrar un cobro, con una sola acción, para no tener que escribir el mensaje ni buscar el número del cliente a mano.

**Why this priority**: Ya está dibujado en el mockup como una acción disponible junto a "Emitir este préstamo" y junto a la confirmación de cobro, y agiliza el trabajo diario de campo — pero no bloquea la operación si todavía no existe (a diferencia de la Historia 1, no depende de ninguna revisión automática ni de tener la API configurada).

**Independent Test**: Emitir un préstamo y tocar "Compartir tabla por WhatsApp"; por separado, registrar un cobro y tocar "Enviar comprobante por WhatsApp"; en ambos casos verificar que se abre WhatsApp (o el selector de la app) con el número del cliente y el mensaje ya redactado, listo para revisar y enviar — se puede probar de punta a punta sin depender de las otras historias ni de la configuración de la API.

**Acceptance Scenarios**:

1. **Given** que acabo de emitir un préstamo para un cliente con teléfono registrado, **When** toco "Compartir tabla por WhatsApp", **Then** se abre una conversación de WhatsApp dirigida a ese cliente con un mensaje que resume el préstamo (monto, cuotas, primer vencimiento) ya redactado.
2. **Given** que acabo de registrar un cobro (total o parcial) sobre una cuota, **When** toco "Enviar comprobante por WhatsApp", **Then** se abre una conversación de WhatsApp dirigida al cliente de esa cuota con un mensaje que resume el comprobante (monto recibido, cuota, saldo restante si quedó parcial) ya redactado.
3. **Given** que el cliente no tiene un número de teléfono válido registrado, **When** reviso la pantalla de emisión o de cobro, **Then** el botón de compartir por WhatsApp aparece deshabilitado con una indicación clara del motivo.

---

### Edge Cases

- **Cliente sin número de teléfono válido**: se omite silenciosamente de las notificaciones automáticas (Historia 1) y el botón manual (Historia 3) aparece deshabilitado con un motivo claro — nunca un error ni un intento fallido de envío.
- **Cuota que cambia de estado entre la detección y el envío** (ej. se paga justo antes de que salga el recordatorio): no se envía la notificación que ya no aplica.
- **Revisión automática repetida sobre la misma cuota sin cambios**: no duplica el recordatorio ni la alerta de mora ya enviados para esa cuota (idempotencia por cuota + tipo de notificación).
- **Cuota con pago parcial que sigue vencida**: sigue siendo elegible para alerta de mora hasta que su saldo llegue a $0 o el préstamo se liquide.
- **Credenciales de WhatsApp ausentes o inválidas al momento de una revisión automática**: el envío queda en modo simulado/registrado (nunca se pierde silenciosamente) y el historial lo marca como tal.
- **Pérdida de conexión durante una acción manual de compartir (Historia 3)**: mensaje claro, no bloquea el resto de la app ni dificulta la sesión de cobro en curso.
- **Historial de notificaciones con cartera vacía**: muestra un estado vacío claro, no un error.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE detectar automáticamente, sin selección manual del administrador, qué cuotas están próximas a vencer (elegibles para recordatorio) y cuáles ya están vencidas sin pagar por completo (elegibles para alerta de mora).
- **FR-002**: Para cada cuota detectada en FR-001, el sistema DEBE preparar y enviar un mensaje de WhatsApp al cliente correspondiente sin que el administrador redacte el mensaje manualmente.
- **FR-003**: La revisión de FR-001 y el envío de FR-002 DEBEN dispararse de forma automática y periódica (programada desde Supabase), sin que el administrador tenga que iniciar la revisión manualmente cada vez — "automático" significa que nadie tiene que acordarse de disparar el proceso, no solo que el sistema decide a quién notificar una vez iniciado.
- **FR-004**: El sistema DEBE permitir al administrador ingresar y guardar, desde apps/web, las credenciales de conexión con Twilio (proveedor de WhatsApp de esta fase), e indicar claramente si la conexión está activa o no.
- **FR-005**: Una vez guardada una credencial, el sistema NO DEBE volver a mostrarla completa en pantalla.
- **FR-006**: El envío hacia la API de WhatsApp DEBE implementarse detrás de una interfaz intercambiable en `@repo/core` (mismo patrón DIP que `ILoanRepository`), con dos implementaciones: una simulada/de registro (usada por defecto en este entorno de desarrollo) y una real contra Twilio WhatsApp Sandbox — intercambiables por configuración, sin tocar el código de las vistas ni de `@repo/core`. La implementación real DEBE verificarse con un envío de prueba real antes de dar esta fase por entregada, con el mismo rigor con que las fases anteriores se verificaron contra una base de datos real.
- **FR-007**: El sistema DEBE permitir compartir por WhatsApp, con una sola acción del usuario, la tabla de amortización de un préstamo recién emitido (mobile y web).
- **FR-008**: El sistema DEBE permitir enviar por WhatsApp, con una sola acción del usuario, un comprobante del cobro recién registrado (mobile y web).
- **FR-009**: Las acciones manuales de FR-007/008 DEBEN funcionar sin requerir que la conexión de la API de WhatsApp (FR-004–006) esté configurada — abren la conversación de WhatsApp del cliente con el mensaje ya preparado para que el usuario la revise y la envíe él mismo, igual que el mockup lo sugiere ("acción, todavía no integración").
- **FR-010**: El sistema NO DEBE intentar enviar ni preparar ningún mensaje (automático o manual) para un cliente sin un número de teléfono válido registrado — se omite silenciosamente de los envíos automáticos (FR-001–003), y la acción manual (FR-007/008) aparece deshabilitada con un motivo claro.
- **FR-011**: Toda lógica para decidir qué cuota está próxima a vencer o en mora DEBE reutilizar exactamente el mismo cálculo de vencimiento/mora ya existente para el resto del sistema (Principios II/IV de la constitución) — nunca una segunda fórmula paralela solo para decidir a quién notificar.
- **FR-012**: El sistema DEBE mantener un historial consultable de cada notificación automática enviada o simulada — cuota, cliente, tipo (recordatorio o mora), fecha/hora y resultado (enviado, simulado o fallido) — para que el administrador pueda auditar qué se envió sin depender de WhatsApp mismo.
- **FR-013**: Una revisión automática repetida sobre una cuota que ya tiene una notificación del mismo tipo registrada en su ventana vigente NO DEBE generar un envío duplicado.

### Key Entities *(include if feature involves data)*

- **Configuración de WhatsApp**: credenciales del proveedor (Twilio o Meta) y estado de conexión (activa/inactiva). Un solo registro, consistente con el modelo single-tenant ya establecido.
- **Notificación de cobro (historial)**: un registro por cada recordatorio o alerta automática enviada o simulada — cuota y cliente relacionados, tipo (recordatorio/mora), momento, y resultado. Nueva entidad; las acciones manuales de la Historia 3 no generan un registro aquí (no son automáticas).
- **Cliente**: reutiliza el número de teléfono ya almacenado en fases anteriores; esta fase no añade campos nuevos al cliente, solo lee su teléfono para decidir si es elegible para notificación.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Al disparar una revisión de cobros del día, el sistema notifica (real o simuladamente) al 100% de las cuotas que cumplen la condición de recordatorio o mora en ese momento, sin que el administrador las revise una por una.
- **SC-002**: Un administrador puede configurar la conexión con la API de WhatsApp, de principio a fin, en menos de 2 minutos.
- **SC-003**: Compartir la tabla de un préstamo o el comprobante de un cobro por WhatsApp toma una sola acción desde la pantalla donde ya se emitió el préstamo o se registró el cobro, sin recomponer el mensaje a mano.
- **SC-004**: El historial de notificaciones permite confirmar, para cualquier cuota, si ya se le envió un recordatorio o una alerta de mora, y cuándo, sin necesidad de abrir WhatsApp.
- **SC-005**: Ningún cliente sin número de teléfono válido genera un intento de notificación automática ni un botón manual habilitado (0 casos).
- **SC-006**: Repetir la revisión automática sobre la misma cartera sin cambios no genera ninguna notificación duplicada.

## Assumptions

- **El proveedor real de esta fase es Twilio WhatsApp Sandbox** — una cuenta de prueba gratuita, sin verificación de negocio ni aprobación de plantillas (a diferencia de Meta Cloud API), pensada exactamente para verificar un envío real en desarrollo. El usuario la crea y comparte sus credenciales (Account SID, Auth Token, número de sandbox) para que la implementación real se verifique con un mensaje de WhatsApp de verdad antes de dar la fase por entregada — mismo rigor que la verificación contra Postgres real de las fases 1-4. Meta Cloud API queda fuera de esta fase; la interfaz intercambiable (FR-006) permite añadirla después sin rediseñar nada.
- **El disparo periódico de FR-003 se implementa con la programación de tareas ya disponible en Supabase** (extensión `pg_cron` invocando una función/Edge Function) — el mecanismo exacto de verificación en este entorno de desarrollo (invocar la función directamente para probar su lógica, sin depender de esperar al reloj) es una decisión de `/speckit-plan`, no de esta especificación.
- **Las plantillas de mensaje exactas** (texto de recordatorio, de mora, de comprobante, de tabla compartida) son una decisión de implementación para `/speckit-plan`, no bloquean esta especificación.
- **Un solo prestamista administrador, sin autenticación** — consistente con `spec.md` raíz y las specs anteriores.
- **Las acciones manuales de compartir (Historia 3) usan un enlace `wa.me` o equivalente** — no requieren backend ni credenciales, consistente con la nota del propio mockup ("WhatsApp aparece como acción, todavía no como integración").
- **No se incluyen respuestas entrantes de WhatsApp ni webhooks** de mensajes recibidos — fuera de alcance según el Input de esta spec.
- **Esta es la última fase del roadmap de negocio** (`spec.md` raíz, Anexo) — no hay una Fase 6 que planificar después de esta.
