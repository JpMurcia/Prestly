# Feature Specification: Marca Prestly, selector de moneda y cierre de brechas de mockup

**Feature Branch**: `006-rebrand-currency-polish`

**Created**: 2026-09-05

**Status**: Draft

**Input**: User description: "Renombrar la aplicación a 'Prestly' en todas las superficies (web sidebar + logo, app.json de mobile), agregar selector de moneda (Pesos colombianos COP como predeterminada, más USD y MXN) configurable desde una nueva página 'Configuración' en apps/web que fusiona la actual página de WhatsApp, consumido en modo solo-lectura por apps/mobile, respaldado por una tabla singleton nueva en Supabase; implementar todos los hallazgos de categoría 'botón' de specs/005-mockup-consistency-audit/REPORT.md que sigan pendientes (etiquetas, forma, íconos, botones faltantes que reutilizan flujos existentes) más el contenido faltante del mockup identificado como alcance completo: tarjetas KPI y columnas extra en la tabla de clientes web, tarjeta 'Cobrado' + barra de progreso en el drawer web, botón y página nueva 'Perfil completo' en web (sin artboard propio, espejando la pantalla de perfil 360° de mobile), barra de acciones inferior en el perfil 360° de mobile, y botón '+ Nuevo'/'Nuevo cliente' en directorio mobile y web (nuevo flujo compartido de alta de cliente sin préstamo). Se excluyen explícitamente de este alcance: color por categoría del Chip compartido, alto/color del track de ProgressBar, el checkbox de WhatsApp dentro del modal de cobro, el tercer chip 'Parcial' de método de pago, el botón 'Recordar' por cuota, y el avatar de usuario 'CM' — todos ya marcados en el reporte de auditoría como cosméticos pospuestos o cambios de producto deliberados. Finalmente, crear supabase/seed.sql (referenciado en config.toml pero inexistente) con datos semilla variados en pesos colombianos: clientes al día, en mora en distintos rangos de días, con cobro hoy, con pago parcial registrado, con préstamo liquidado, sin préstamo activo, y cubriendo las 3 frecuencias de pago (semanal/quincenal/mensual)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Selector de moneda (Priority: P1)

Como prestamista, quiero que la aplicación muestre los montos en la moneda real de mi negocio (pesos colombianos) y poder cambiarla si algún día opero en otra, para que las cifras que veo y comparto con mis clientes tengan sentido.

**Why this priority**: Es el hallazgo de mayor impacto de negocio — hoy todos los montos se muestran con formato de dólares estadounidenses, lo cual es incorrecto para el mercado real de la app.

**Independent Test**: Puede probarse por completo entrando a "Configuración" en la web, cambiando la moneda entre las 3 opciones, y confirmando que el nuevo formato aparece de inmediato en Dashboard, Calculadora, Clientes y Préstamos activos de la web, y en las pantallas equivalentes de la app móvil tras refrescar.

**Acceptance Scenarios**:

1. **Given** una instalación nueva de la aplicación, **When** un administrador abre cualquier pantalla que muestre dinero, **Then** los montos aparecen formateados en pesos colombianos (COP) sin necesidad de configuración adicional.
2. **Given** la pantalla "Configuración" en la web, **When** el administrador selecciona "Dólar estadounidense" o "Peso mexicano" y guarda, **Then** todas las pantallas de la web que muestran dinero reflejan la nueva moneda inmediatamente, sin recargar manualmente cada una.
3. **Given** que la moneda fue cambiada desde la web, **When** un cobrador abre la app móvil, **Then** ve los montos en la misma moneda configurada (no puede cambiarla desde el móvil).

---

### User Story 2 - Identidad de marca "Prestly" (Priority: P1)

Como prestamista, quiero ver el nombre real de mi producto ("Prestly") en cada superficie de la aplicación, para que la marca sea consistente frente a mí y mis clientes.

**Why this priority**: Alta visibilidad, bajo riesgo — corrige una inconsistencia notoria (el título de la pestaña del navegador ya dice "Prestly" pero el panel lateral dice "Microcréditos") y afecta la primera impresión de cualquier demo o uso real.

**Independent Test**: Abrir la web y la app móvil y confirmar visualmente que ningún texto ni ícono visible dice "Microcréditos" u otro nombre distinto de "Prestly".

**Acceptance Scenarios**:

1. **Given** la aplicación web abierta, **When** el usuario mira el panel lateral, **Then** el nombre mostrado junto al logo es "Prestly".
2. **Given** la app móvil instalada en un dispositivo o emulador, **When** el usuario ve el nombre de la app en la pantalla de inicio del sistema operativo, **Then** el nombre mostrado es "Prestly".

---

### User Story 3 - Alta de cliente sin préstamo (Priority: P2)

Como prestamista, quiero poder registrar un cliente nuevo en mi directorio sin tener que emitirle un préstamo en el mismo paso, para poder llevar el registro de contactos y clientes potenciales antes de prestarles dinero.

**Why this priority**: Es un flujo que hoy no existe de ninguna forma (crear cliente solo es posible como parte de emitir un préstamo) y es prerrequisito de los botones "+ Nuevo"/"Nuevo cliente" pedidos explícitamente en el directorio de ambas plataformas.

**Independent Test**: Desde el directorio de clientes (web o móvil), crear un cliente nuevo únicamente con nombre y teléfono, sin pasar por la calculadora ni emitir ningún préstamo, y confirmar que aparece en el directorio con estado "Sin préstamo activo".

**Acceptance Scenarios**:

1. **Given** el directorio de clientes en la web, **When** el administrador pulsa "Nuevo cliente" y completa nombre y teléfono, **Then** el cliente se guarda y aparece en el directorio sin ningún préstamo asociado.
2. **Given** el directorio de clientes en la app móvil, **When** el cobrador pulsa "+ Nuevo" y completa nombre y teléfono, **Then** el cliente se guarda y aparece en el directorio sin ningún préstamo asociado.
3. **Given** un teléfono que ya pertenece a un cliente existente, **When** se intenta crear un cliente nuevo con ese mismo teléfono, **Then** el sistema rechaza la creación duplicada (misma regla que ya aplica al alta de cliente durante la emisión de un préstamo).

---

### User Story 4 - Fidelidad del flujo móvil de campo respecto al mockup (Priority: P2)

Como cobrador en campo, quiero que la calculadora, el directorio, el perfil del cliente y la ruta de cobranza se vean y se comporten como el diseño original aprobado, para tener una herramienta pulida frente al cliente al momento de cobrar o prestar.

**Why this priority**: Afecta directamente la percepción del cliente final durante la interacción cara a cara — es el uso diario principal de la app móvil.

**Independent Test**: Recorrer las 4 pantallas móviles señaladas en `specs/005-mockup-consistency-audit/REPORT.md` y confirmar, hallazgo por hallazgo (categoría "botón" + los 2 ítems de contenido que le corresponden a móvil), que ya no aparecen en una nueva revisión.

**Acceptance Scenarios**:

1. **Given** la calculadora de préstamos, **When** el cobrador quiere compartir la tabla de amortización, **Then** ve un botón "Compartir tabla por WhatsApp" con ícono de WhatsApp que abre WhatsApp directamente con el mensaje prellenado.
2. **Given** la calculadora de préstamos, **When** el cobrador alterna entre "Ver resumen" y "Ver tabla completa", **Then** ve un control segmentado de dos pestañas (no un texto simple que cambia de etiqueta).
3. **Given** el perfil 360° de un cliente, **When** el cobrador quiere contactarlo o prestarle de nuevo, **Then** ve una barra de acciones fija con "Llamar", "WhatsApp" y "Nuevo préstamo" (este último abre la calculadora con el cliente preseleccionado).
4. **Given** el perfil 360° de un cliente, **When** el cobrador ve la sección "Notas privadas", **Then** el contenido se muestra de solo lectura con un enlace "Editar" que habilita la edición (en vez de un campo siempre editable).
5. **Given** la ruta de cobranza del día, **When** el cobrador ve el botón de acción de una fila, **Then** su forma es un cuadrado redondeado (no un círculo).

---

### User Story 5 - Fidelidad y contenido del panel web respecto al mockup (Priority: P2)

Como prestamista administrando desde la web, quiero ver toda la información de cartera y clientes que el diseño original prometía (KPIs, columnas de la tabla, perfil completo de cada cliente), para tomar decisiones sin tener que adivinar datos que no están a la vista.

**Why this priority**: Es el centro de control del negocio; la falta de columnas/KPIs obliga hoy a abrir el detalle de cada cliente uno por uno para ver información que el mockup mostraba de un vistazo.

**Independent Test**: Recorrer las 2 pantallas web con mockup propio en `specs/005-mockup-consistency-audit/REPORT.md` más la nueva página de perfil, y confirmar que cada hallazgo de categoría "botón" y cada ítem de contenido asignado a web ya no aparece en una nueva revisión.

**Acceptance Scenarios**:

1. **Given** la pantalla de préstamos activos/amortización, **When** el administrador mira las pestañas de filtro, **Then** cada pestaña muestra su conteo junto a la etiqueta (p. ej. "Todas · 12").
2. **Given** la tabla de amortización de un préstamo, **When** el administrador la revisa, **Then** incluye una columna de saldo restante por cuota.
3. **Given** el directorio de clientes en la web, **When** el administrador lo abre, **Then** ve 3 tarjetas KPI (clientes activos, préstamo promedio, tasa de reincidencia) sobre la tabla, y la tabla incluye columnas de préstamos, comportamiento/score, próximo pago y acciones por fila.
4. **Given** el directorio de clientes en la web, **When** el administrador se desplaza al final de la tabla, **Then** ve una barra de pie con el saldo agregado y el score medio de los clientes listados.
5. **Given** el panel de detalle (drawer) de un cliente, **When** el administrador lo abre, **Then** ve una tercera tarjeta "Cobrado" (además de "Prestado" y "Saldo") y una barra de progreso de amortización con la etiqueta "X de Y · Z%".
6. **Given** el panel de detalle (drawer) de un cliente, **When** el administrador pulsa "Perfil completo", **Then** navega a una página dedicada con el historial completo de préstamos, notas y score de ese cliente.

---

### User Story 6 - Datos semilla para pruebas y demostraciones (Priority: P3)

Como desarrollador o persona que hace una demo del producto, quiero que una base de datos local recién reseteada ya tenga una cartera de ejemplo variada, para poder probar o mostrar la aplicación sin tener que crear clientes y préstamos manualmente cada vez.

**Why this priority**: Acelera pruebas y demos, pero no bloquea a los usuarios finales del producto — es una herramienta de desarrollo.

**Independent Test**: Ejecutar el comando de reseteo de la base de datos local y, sin ninguna acción manual adicional, ver una cartera de clientes con variedad de estados en el directorio de ambas apps.

**Acceptance Scenarios**:

1. **Given** una base de datos local recién reseteada, **When** se abre el directorio de clientes en cualquiera de las dos apps, **Then** aparece una cartera de ejemplo con clientes en cada uno de estos estados: al día, en mora (con distintos rangos de días de atraso), con cobro esperado hoy, con un pago parcial ya registrado, con un préstamo ya liquidado, y sin ningún préstamo activo.
2. **Given** la misma base reseteada, **When** se revisan los préstamos de ejemplo, **Then** están representadas las 3 frecuencias de pago (semanal, quincenal, mensual) y los montos están expresados en magnitudes realistas para pesos colombianos (no en cifras pensadas para dólares).

---

### Edge Cases

- ¿Qué pasa si dos personas cambian la moneda casi al mismo tiempo desde dos pestañas de la web? Gana el último guardado (no se requiere bloqueo de concurrencia — es una única fila de configuración de baja frecuencia de cambio).
- ¿Qué pasa si la app móvil no puede leer la configuración de moneda (sin conexión)? Debe seguir mostrando la última moneda conocida o, si nunca la cargó, el valor por defecto (COP), nunca un error bloqueante ni un monto sin formato.
- ¿Qué pasa si se intenta crear un cliente nuevo con un teléfono vacío o inválido? Se rechaza con el mismo mensaje de validación que ya usa el alta de cliente dentro del flujo de emisión de préstamo.
- ¿Qué pasa con un cliente sembrado "sin préstamo activo" al abrir su perfil completo? Debe mostrar el estado vacío correspondiente (score sin historial, sin préstamos), no un error.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE mostrar todos los montos monetarios en pesos colombianos (COP) de forma predeterminada, sin configuración previa.
- **FR-002**: El sistema DEBE permitir a un administrador, desde la web, cambiar la moneda activa entre Peso colombiano, Dólar estadounidense y Peso mexicano.
- **FR-003**: El cambio de moneda hecho desde la web DEBE reflejarse en todas las pantallas de la web y de la app móvil que muestren montos, sin requerir una nueva instalación ni intervención manual distinta de reabrir/refrescar la pantalla.
- **FR-004**: La app móvil DEBE mostrar la moneda activa configurada pero NO DEBE ofrecer una forma de cambiarla.
- **FR-005**: Todas las superficies visibles de la aplicación (panel lateral de la web, nombre de la app móvil en el dispositivo) DEBEN mostrar el nombre "Prestly".
- **FR-006**: El sistema DEBE permitir crear un cliente nuevo (nombre y teléfono, con dirección opcional) sin exigir la emisión de un préstamo en el mismo paso, desde el directorio de clientes de la web y de la app móvil.
- **FR-007**: El sistema DEBE impedir crear un cliente con un teléfono que ya pertenece a otro cliente existente, sin importar si se crea junto con un préstamo o de forma independiente.
- **FR-008**: La calculadora móvil DEBE ofrecer un botón para compartir la tabla de amortización directamente por WhatsApp, con su etiqueta e ícono correspondientes.
- **FR-009**: La calculadora móvil DEBE presentar el alternador entre resumen y tabla completa como un control segmentado de dos opciones.
- **FR-010**: El perfil del cliente en la app móvil DEBE ofrecer acciones directas para llamar al cliente, contactarlo por WhatsApp, e iniciar un nuevo préstamo para ese cliente.
- **FR-011**: El campo de notas privadas del cliente en la app móvil DEBE mostrarse de solo lectura por defecto, con una acción explícita para entrar en modo edición.
- **FR-012**: El botón de acción de cada fila en la ruta de cobranza móvil DEBE tener forma de cuadrado redondeado.
- **FR-013**: Las pestañas de filtro de la pantalla de préstamos activos en la web DEBEN mostrar el número de préstamos que cada filtro representa.
- **FR-014**: La tabla de amortización de un préstamo en la web DEBE incluir el saldo restante de cada cuota.
- **FR-015**: El directorio de clientes en la web DEBE mostrar indicadores agregados de cartera (clientes activos, préstamo promedio, tasa de reincidencia) y, por cada cliente, sus préstamos, su comportamiento de pago, la fecha de su próximo pago, y acciones directas.
- **FR-016**: El directorio de clientes en la web DEBE mostrar un resumen de saldo total y score promedio de los clientes actualmente listados.
- **FR-017**: El panel de detalle de un cliente en la web DEBE mostrar cuánto se le ha cobrado hasta ahora (además de lo prestado y el saldo) y el avance de amortización de su préstamo activo.
- **FR-018**: El sistema DEBE ofrecer, desde el panel de detalle de un cliente en la web, una página de perfil completo con su historial de préstamos, notas y score.
- **FR-019**: El sistema DEBE poder poblarse, en un entorno de desarrollo local, con una cartera de ejemplo que cubra clientes al día, en mora, con cobro hoy, con pago parcial, con préstamo liquidado, y sin préstamo activo, en las 3 frecuencias de pago soportadas.

### Key Entities

- **Configuración de moneda**: preferencia única y compartida por toda la instalación (no por cliente ni por préstamo) que determina en qué moneda se muestran los montos; tiene un valor activo entre un conjunto fijo de monedas soportadas.
- **Cliente**: entidad ya existente en el sistema; se extiende la forma de crearlo para permitir un alta independiente de cualquier préstamo, conservando la misma regla de teléfono único.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de las pantallas que muestran montos (web y móvil) reflejan la moneda activa configurada, verificado recorriendo cada pantalla tras un cambio de moneda.
- **SC-002**: Ningún texto visible de la aplicación (web o móvil) muestra un nombre de marca distinto de "Prestly".
- **SC-003**: Un cliente puede registrarse sin préstamo en menos de 3 campos (nombre, teléfono, dirección opcional) desde ambas plataformas.
- **SC-004**: Los 15 hallazgos de categoría "botón" listados en `specs/005-mockup-consistency-audit/REPORT.md` que no estén explícitamente excluidos de este alcance quedan resueltos, verificado con una nueva pasada de auditoría dirigida solo a esos hallazgos.
- **SC-005**: Las 6 piezas de contenido faltante identificadas (KPIs, columnas extra, tarjeta "Cobrado" + progreso, página de perfil completo, barra de acciones inferior móvil, flujo de alta de cliente) están presentes y navegables sin errores.
- **SC-006**: Un reseteo de la base de datos local deja el directorio de clientes con al menos 8 clientes de ejemplo cubriendo las 6 situaciones de cartera descritas en User Story 6, verificable sin ninguna acción manual posterior al reseteo.

## Assumptions

- La app es de un único prestamista (single-tenant, ver `spec.md` raíz) — por eso la moneda es una única preferencia global, no una preferencia por cliente, por préstamo ni por usuario.
- El Peso colombiano se muestra sin decimales (uso convencional en Colombia); Dólar estadounidense y Peso mexicano mantienen 2 decimales.
- La página "Configuración" en la web reemplaza a la actual página "WhatsApp" del panel lateral, agrupando en un mismo lugar la moneda y la conexión con Twilio que ya existía — no se agrega un ítem nuevo al menú.
- La página de "Perfil completo" en la web no tiene un artboard propio en el mockup original; se construye espejando el contenido y la información de la pantalla equivalente de la app móvil (perfil 360°), adaptada al layout de escritorio.
- Quedan fuera de este alcance (ya señalados en `specs/005-mockup-consistency-audit/REPORT.md` como cosméticos pospuestos o cambios de producto deliberados): color por categoría del `Chip` compartido, alto/color del track de `ProgressBar`, el checkbox de WhatsApp dentro del modal de cobro, el tercer chip "Parcial" de método de pago, el botón "Recordar" por cuota, y el avatar de usuario "CM".
- El slug interno de Expo (`apps/mobile/app.json`, campo `slug`) no es visible a usuarios finales y no se modifica; solo cambia el nombre visible (`name`).
- No existe hoy un sistema de autenticación/usuarios (ver `spec.md` raíz, Fase 1 fuera de alcance) — ninguna pieza de este spec depende de saber "quién" es el administrador conectado.
