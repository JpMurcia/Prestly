# Feature Specification: App Móvil de Cobranza en Campo

**Feature Branch**: `001-mobile-field-app`

**Created**: 2026-09-03

**Status**: Draft

**Input**: User description: "Fase 2 del roadmap de negocio (ver Anexo de `spec.md` raíz): la App Móvil (React Native/Expo) para el prestamista — cotizar y emitir préstamos en el momento, directorio de clientes y cartera, perfil 360° del cliente con score de confianza, ruta de cobranza diaria y registro de cobros. Basado en los mockups `Docs/Plataforma Mockus/Microcreditos - Mockups.dc.html` (pantallas 1a, 1b, 2a, 2b, 2c, 2d) y en las Historias 1–3 del `spec.md` raíz."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cotizar y emitir un préstamo frente al cliente (Priority: P1)

Como prestamista, quiero ajustar monto, tasa, plazo y frecuencia de un préstamo con controles rápidos mientras estoy con el cliente, ver el total a pagar y la tabla de cuotas al instante, y emitir el préstamo ahí mismo si el cliente acepta — sin tener que volver a la oficina ni recalcular a mano.

**Why this priority**: Es el primer contacto con cada préstamo nuevo y el momento donde se cierra o se pierde el trato. Sin esta pantalla no hay negocio que gestionar en el resto de la app.

**Independent Test**: Se puede probar completamente ajustando los parámetros de una simulación, verificando que el total/cuota/tabla se recalculan al instante, y confirmando "Emitir este préstamo" para un cliente nuevo o existente — entrega valor por sí sola incluso si el resto de la app (directorio, ruta de cobranza) no existiera todavía.

**Acceptance Scenarios**:

1. **Given** que estoy en la calculadora, **When** ajusto monto, tasa, plazo o frecuencia con los controles, **Then** el total a pagar, la cuota, la ganancia y la vista previa de la tabla se actualizan de inmediato, sin llamada de red.
2. **Given** una cotización ya calculada, **When** toco "Ver la tabla completa", **Then** veo las N cuotas con número, fecha de vencimiento, capital, interés y cuota, más una fila de totales que coincide exactamente con el resumen.
3. **Given** una cotización que quiero mostrarle al cliente sin comprometerme aún, **When** toco "Compartir tabla", **Then** la app abre la hoja de compartir del dispositivo con la tabla ya redactada como mensaje, sin emitir el préstamo.
4. **Given** una cotización calculada, **When** toco "Emitir este préstamo" y selecciono un cliente existente o capturo nombre y teléfono de uno nuevo, **Then** el préstamo se crea con sus cuotas ya generadas y aparece de inmediato en el directorio y en la ruta de cobranza correspondiente.

---

### User Story 2 - Cobrar una cuota en la ruta de cobranza diaria (Priority: P1)

Como prestamista, quiero abrir mi ruta de cobranza del día ordenada por prioridad (mora primero, luego vence hoy) y registrar cada cobro con el cambio calculado automáticamente, para no perder tiempo con matemática manual ni con clientes fuera de orden.

**Why this priority**: Es la operación que se repite todos los días y de la que depende el flujo de caja del negocio; un error de cambio o una cuota olvidada tiene costo inmediato.

**Independent Test**: Se puede probar con un préstamo que tenga cuotas pendientes: abrir la ruta del día, tocar un cliente, ingresar el monto recibido y confirmar el cobro — el saldo del préstamo y el resumen del día se actualizan solos, de forma verificable sin tocar ninguna otra pantalla.

**Acceptance Scenarios**:

1. **Given** que tengo clientes con cuotas vencidas y clientes que vencen hoy, **When** abro la ruta de cobranza, **Then** los veo en una sola lista ordenada con los vencidos primero (marcados en rojo con días de mora) y los que vencen hoy después (marcados en ámbar), junto con el monto total esperado del día y cuánto llevo cobrado.
2. **Given** una cuota pendiente en la ruta, **When** toco su botón de cobro rápido, **Then** se abre un formulario con el monto de la cuota, un campo para el monto recibido y el método de pago (efectivo/transferencia).
3. **Given** que ingreso un monto recibido mayor al de la cuota en efectivo, **When** confirmo el cobro, **Then** la app calcula y muestra el cambio a entregar (recibido − monto de la cuota) antes de guardar.
4. **Given** que confirmo un cobro, **When** la operación se completa, **Then** la cuota pasa a "pagado", desaparece de la ruta pendiente del día, y el resumen del día (monto cobrado, clientes registrados) se actualiza de inmediato.
5. **Given** que ya cobré todas las cuotas pendientes del día, **When** vuelvo a la ruta de cobranza, **Then** veo un estado vacío que confirma que no quedan cobros pendientes hoy.

---

### User Story 3 - Consultar el directorio y la cartera de clientes (Priority: P2)

Como prestamista, quiero buscar y filtrar mi cartera completa de clientes por nombre, teléfono o estado (todos / cobro hoy / al día / en mora), para ubicar a cualquier cliente y saber su situación sin abrir cada préstamo uno por uno.

**Why this priority**: Es la herramienta de consulta rápida que se usa varias veces al día entre cobros, pero no bloquea la operación diaria si el prestamista tiene pocos clientes y los recuerda de memoria (a diferencia de US1 y US2, que son imprescindibles desde el primer día).

**Independent Test**: Se puede probar con una cartera de varios clientes en distintos estados: buscar por nombre parcial o teléfono y confirmar que aparece el cliente correcto; aplicar cada filtro de estado y confirmar que la lista y su conteo coinciden con los clientes en ese estado.

**Acceptance Scenarios**:

1. **Given** que tengo varios clientes en mi cartera, **When** escribo parte de un nombre o número de teléfono en el buscador, **Then** la lista se filtra a los clientes que coinciden.
2. **Given** el directorio completo, **When** toco un filtro de estado ("Cobro hoy", "Al día", "Mora"), **Then** la lista muestra solo los clientes en ese estado y el conteo del filtro coincide con la cantidad mostrada.
3. **Given** una tarjeta de cliente en el directorio, **When** la reviso, **Then** veo su estado actual, saldo pendiente frente al monto prestado, y el progreso de cuotas pagadas, sin necesidad de entrar a su perfil.
4. **Given** un cliente con una cuota vencida, **When** lo veo en el directorio, **Then** su tarjeta indica claramente los días de mora.
5. **Given** una búsqueda que no coincide con ningún cliente, **When** reviso el resultado, **Then** veo un estado vacío que lo indica claramente en vez de una lista en blanco.

---

### User Story 4 - Evaluar el perfil 360° de un cliente antes de prestarle de nuevo (Priority: P3)

Como prestamista, quiero abrir el expediente completo de un cliente — score de confianza, historial de puntualidad, préstamos anteriores y notas privadas — para decidir con información si le doy un nuevo préstamo.

**Why this priority**: Aporta valor de decisión (reduce el riesgo de prestarle a un mal pagador) pero no es indispensable para operar el día a día como sí lo son cotizar y cobrar; puede añadirse después de que las dos primeras historias ya funcionen.

**Independent Test**: Se puede probar con un cliente que tenga al menos un préstamo liquidado y uno activo: abrir su perfil y verificar que el score, el historial de puntualidad y la lista de préstamos (activos y liquidados) se muestran correctamente, y que agregar o editar una nota privada se guarda y persiste.

**Acceptance Scenarios**:

1. **Given** un cliente con historial de cuotas, **When** abro su perfil, **Then** veo su score de confianza como letra (A+/A/B/C) acompañada siempre de la fracción que lo sustenta (ej. "19 de 20 cuotas"), nunca solo la letra.
2. **Given** un cliente sin ninguna cuota vencida todavía, **When** abro su perfil, **Then** el score se muestra como "sin historial" en lugar de una letra o de un error.
3. **Given** un cliente con préstamos anteriores, **When** reviso su historial, **Then** veo cada préstamo (activo o liquidado) con su monto, plazo, tasa y si tuvo o no atrasos.
4. **Given** que quiero recordar algo sobre un cliente (ej. una promesa de pago), **When** escribo o edito una nota privada en su perfil, **Then** la nota se guarda con fecha de actualización y es visible la próxima vez que abro ese perfil.

---

### Edge Cases

- **Cliente sin historial de cuotas vencidas**: el score de confianza se muestra como "sin historial", nunca como una división por cero ni como C/mal calificado.
- **Cliente con cuota vencida sin pagar**: se refleja como mora (con días) de forma consistente en el directorio, la ruta de cobranza y el perfil — el mismo cálculo, no tres números distintos.
- **Ruta de cobranza sin pendientes**: si ya se cobraron todas las cuotas del día, se muestra un estado vacío positivo en vez de una lista en blanco o un error.
- **Directorio sin resultados de búsqueda**: se muestra un mensaje de "sin resultados", nunca una lista vacía sin explicación.
- **Monto recibido igual al de la cuota**: el cambio a entregar es $0 y no se muestra como advertencia.
- **Emisión de préstamo a cliente nuevo**: si el nombre/teléfono capturado coincide con un cliente ya existente, el sistema no debe crear un duplicado silencioso (ver FR-004 y Assumptions sobre desambiguación mínima).
- **Pérdida de conexión durante un cobro o una emisión**: la app muestra un aviso y no marca la cuota como pagada ni el préstamo como emitido hasta confirmar que la operación se guardó (ver FR-013); el prestamista debe reintentar al recuperar señal, sin registrar el cobro dos veces.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La app DEBE permitir cotizar un préstamo ajustando monto, tasa de interés, número de cuotas y frecuencia de pago, recalculando cuota, interés total, ganancia y tabla de amortización de forma instantánea y sin necesidad de conexión a internet.
- **FR-002**: La app DEBE mostrar, antes de emitir un préstamo, la tabla de amortización completa (todas las cuotas con fecha, capital, interés y monto) cuyos totales coincidan exactamente con el resumen de la cotización.
- **FR-003**: La app DEBE permitir compartir la tabla de amortización cotizada mediante la función nativa de compartir del dispositivo, como una acción manual e independiente de emitir el préstamo.
- **FR-004**: La app DEBE permitir emitir un préstamo directamente desde una cotización calculada, asociándolo a un cliente ya existente (buscándolo) o a uno nuevo capturando como mínimo su nombre y teléfono.
- **FR-005**: La app DEBE ofrecer un directorio de toda la cartera de clientes, buscable por nombre o teléfono, con filtros rápidos por estado de cartera (todos, cobro hoy, al día, en mora) que muestren el conteo de clientes en cada uno.
- **FR-006**: Cada cliente listado en el directorio DEBE mostrar su estado de cartera, el saldo pendiente frente al monto originalmente prestado, y el progreso de cuotas pagadas sobre el total.
- **FR-007**: La app DEBE ofrecer una ruta de cobranza diaria que agrupe todas las cuotas vencidas y las que vencen hoy, ordenadas por prioridad (vencidas primero), junto con un resumen del monto total esperado del día y lo ya cobrado.
- **FR-008**: La app DEBE permitir registrar el cobro de una cuota específica capturando el monto recibido y el método de pago, calculando automáticamente el cambio a entregar cuando el monto recibido sea mayor al de la cuota.
- **FR-009**: Al confirmarse un cobro, la app DEBE reflejar de inmediato el nuevo estado de la cuota, el saldo del préstamo y el resumen de la ruta de cobranza del día, en todas las pantallas donde ese cliente o préstamo sean visibles.
- **FR-010**: La app DEBE mostrar, en el perfil de cada cliente, su score de confianza como letra (A+/A/B/C) acompañada siempre de la fracción de cuotas puntuales que lo sustenta, nunca solo la letra; y como "sin historial" cuando el cliente aún no tiene cuotas vencidas.
- **FR-011**: La app DEBE mostrar en el perfil del cliente su historial completo de préstamos (activos y liquidados) con monto, plazo, tasa y si tuvo atrasos.
- **FR-012**: La app DEBE permitir al prestamista escribir y editar notas privadas asociadas a un cliente, visibles únicamente dentro de su perfil.
- **FR-013**: Cotizar un préstamo (FR-001) es la única operación que DEBE funcionar sin conexión a internet. Emitir un préstamo y registrar un cobro REQUIEREN conexión activa en el momento de confirmar la acción; si no hay conexión, la app DEBE mostrar un aviso claro y no debe dar por completada la operación hasta confirmar que se guardó.
- **FR-014**: El sistema NO DEBE registrar pagos parciales de una cuota (recibir menos del monto de la cuota y dejar un remanente pendiente sobre esa misma cuota) en esta fase — coincide con la exclusión de "pagos parciales por cuota" del `spec.md` raíz (§1); la opción de pago "Parcial" mostrada en los mockups queda reservada para una fase futura del negocio.

### Key Entities *(include if feature involves data)*

- **Cliente**: la misma entidad definida en el `spec.md` raíz (nombre, teléfono, dirección, notas privadas). Esta fase añade su consumo en pantalla: tarjeta de directorio, fila de ruta de cobranza y perfil 360°.
- **Préstamo**: la misma entidad del `spec.md` raíz. Esta fase asume que un cliente tiene como máximo un préstamo activo a la vez (ver Assumptions); su historial de préstamos anteriores (liquidados) se conserva y se muestra en el perfil.
- **Cuota**: la misma entidad del `spec.md` raíz. Esta fase la expone en tres vistas distintas (tabla de amortización, fila de ruta de cobranza, cronograma del préstamo) que deben derivarse del mismo dato, nunca de cálculos duplicados.
- **Ruta de cobranza**: no es una entidad almacenada — es una vista derivada del día actual que agrupa las cuotas de todos los préstamos activos cuya fecha de vencimiento sea hoy o anterior y sigan `pendiente`.
- **Nota privada**: texto libre asociado a un cliente (campo `notas_privadas` ya definido en el `spec.md` raíz), con fecha de última actualización.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un prestamista puede cotizar y emitir un préstamo completo frente al cliente en menos de 2 minutos desde que abre la calculadora hasta la confirmación de emisión.
- **SC-002**: Un prestamista puede registrar el cobro de una cuota, incluyendo el cálculo de cambio, en menos de 30 segundos por cliente.
- **SC-003**: Un prestamista puede ver y completar el 100% de su ruta de cobranza del día (todos los vencidos y los que vencen hoy) sin consultar ningún registro externo (papel, hoja de cálculo, WhatsApp).
- **SC-004**: Un prestamista puede encontrar cualquier cliente de su cartera por nombre o teléfono y ver su saldo actual en menos de 10 segundos.
- **SC-005**: El score de confianza y el historial de préstamos de un cliente son visibles en 2 toques o menos desde el directorio.
- **SC-006**: El 100% de las cotizaciones (Historia 1) se completan sin necesidad de conexión a internet, verificado en un dispositivo en modo avión.

## Assumptions

- **Un solo prestamista administrador por app** (single-tenant, consistente con el `spec.md` raíz): esta fase no incluye roles, permisos ni múltiples usuarios dentro de la app móvil.
- **Un préstamo activo por cliente a la vez**: el modelo de datos no lo impide a futuro, pero las pantallas de esta fase (directorio, ruta de cobranza) asumen que cada cliente tiene cero o un préstamo activo; préstamos anteriores liquidados sí pueden acumularse en su historial.
- **"Compartir tabla por WhatsApp" y "Enviar comprobante por WhatsApp" son acciones manuales** que abren la función de compartir nativa del dispositivo con un mensaje pre-armado — no son notificaciones automatizadas vía API de negocio. La integración automatizada con Twilio/Meta sigue fuera de alcance (Fase 5 del negocio, según el `spec.md` raíz).
- **Alta de cliente nuevo es mínima**, no un flujo de onboarding completo: solo nombre y teléfono capturados en el momento de emitir un préstamo (consistente con la Historia 2 del `spec.md` raíz, que deja el "flujo completo de alta de cliente" fuera de alcance).
- **Pagos parciales por cuota quedan fuera de alcance** en esta fase (ver FR-014), aunque la interfaz de los mockups muestre la opción "Parcial" como diseño abierto a futuro.
- **No hay vista de mapa ni ruteo geográfico**: "Ordenar" en la ruta de cobranza se refiere a criterios simples (prioridad, nombre, monto), no a optimización de trayecto — consistente con la exclusión de "vista de mapa para rutas de cobranza" del `spec.md` raíz.
- **El motor de cálculo financiero y el modelo de datos son los ya definidos en el `spec.md` raíz** (`@repo/core`, tablas `clientes`/`prestamos`/`cuotas`); esta fase no redefine fórmulas ni esquema, solo su consumo desde la app móvil.
- **El método de pago (efectivo/transferencia) se captura en la UI pero no se persiste todavía**: el esquema de `cuotas` (`spec.md` raíz §4) no tiene una columna para eso; añadirla es un cambio de esquema que debe decidirse primero en `spec.md` raíz, no en esta fase.
- **El modo offline se limita a cotizar** (FR-013, confirmado con el usuario): emitir préstamos y registrar cobros requieren conexión activa en esta fase; no se construye una cola de sincronización ni resolución de conflictos todavía. Puede revisarse en una fase posterior si el uso en campo lo exige.
