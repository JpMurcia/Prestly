# Feature Specification: Admin Web — Dashboard y Gestión de Cartera

**Feature Branch**: `002-admin-web`

**Created**: 2026-09-03

**Status**: Draft

**Input**: User description: "Admin Web (Fase 3 del roadmap de negocio en spec.md): dashboard web para el prestamista, gestión de cartera y préstamos desde apps/web, consumiendo @repo/core y el mismo esquema Supabase que la app móvil"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver el panorama financiero de la cartera desde el dashboard (Priority: P1)

Como prestamista, quiero abrir mi centro de control en la computadora y ver de un vistazo cuánto capital tengo prestado, cuánto he recuperado, cuánto he ganado en intereses y cuánto está en mora, para entender la salud de mi negocio sin sumar nada a mano ni abrir cada préstamo uno por uno.

**Why this priority**: Es la razón de ser de la superficie web frente a la móvil — la móvil prioriza la acción de campo (cotizar, cobrar), la web prioriza la vista consolidada que solo tiene sentido con densidad de datos y una pantalla grande. Sin esto, la web no aporta nada que la app móvil no dé ya.

**Independent Test**: Con una cartera que tenga varios préstamos en distintos estados (al día, en mora, liquidados), abrir el dashboard y verificar que las cuatro métricas (capital prestado, total recuperado, intereses ganados, cartera en mora) coinciden con la suma real de los préstamos y cuotas subyacentes — se puede probar leyendo directamente la base de datos y comparando contra lo mostrado, sin depender de las otras historias.

**Acceptance Scenarios**:

1. **Given** que tengo préstamos activos y liquidados en mi cartera, **When** abro el dashboard, **Then** veo el capital total prestado, el total recuperado (cuotas pagadas), los intereses ganados y el monto en mora, cada uno como una cifra clara y actualizada.
2. **Given** que una cuota pasa de "pendiente" a "pagado" (desde web o desde la app móvil), **When** vuelvo a ver el dashboard, **Then** las métricas reflejan el cambio sin que yo haga nada manual.
3. **Given** que no tengo ninguna cuota vencida sin pagar, **When** veo la métrica de cartera en mora, **Then** muestra $0 de forma clara, no un error ni un espacio vacío.

---

### User Story 2 - Gestionar préstamos activos y registrar cobros desde escritorio (Priority: P1)

Como prestamista, quiero ver todos mis préstamos activos en una tabla densa, abrir la tabla de amortización completa de cualquiera de ellos y registrar el cobro de una cuota sin salir de la pantalla, para llevar la operación del día también desde la computadora cuando no estoy en la calle.

**Why this priority**: Junto con la Historia 1, es lo mínimo para que la web sea una herramienta de trabajo real y no solo un panel de solo-lectura; sin poder registrar cobros aquí, el prestamista sigue dependiendo exclusivamente del teléfono para la operación diaria.

**Independent Test**: Con un préstamo que tenga cuotas pendientes, abrir su tabla de amortización desde la lista de préstamos activos, registrar el cobro de la cuota que vence hoy, y confirmar que la cuota pasa a "pagado" y desaparece de los pendientes — se puede probar de punta a punta sin usar el directorio de clientes ni el dashboard.

**Acceptance Scenarios**:

1. **Given** que tengo préstamos activos, **When** abro la lista de "Préstamos activos", **Then** veo cada uno con su cliente, monto, progreso de cuotas y estado, buscable por nombre de cliente, teléfono o número de préstamo.
2. **Given** un préstamo específico, **When** lo abro, **Then** veo su tabla de amortización completa (todas las cuotas con número, vencimiento, capital, interés, cuota total, saldo restante y estado), con filtros rápidos por "todas / pagadas / pendientes / vence hoy".
3. **Given** una cuota pendiente o que vence hoy, **When** registro su cobro desde esa tabla, **Then** la cuota pasa a "pagado" de inmediato, el saldo restante del préstamo se actualiza, y la fila deja de aparecer como pendiente.
4. **Given** que quiero llevarme la información fuera del sistema, **When** exporto la lista de préstamos activos, **Then** recibo un archivo descargable con los datos actualmente visibles (respetando la búsqueda y los filtros aplicados).
5. **Given** que aún no tengo ningún préstamo activo, **When** abro la lista de préstamos, **Then** veo un estado vacío que lo indica claramente en vez de una tabla en blanco.

---

### User Story 3 - Consultar el directorio de clientes con vista 360° desde escritorio (Priority: P2)

Como prestamista, quiero buscar y filtrar mi cartera completa de clientes desde la computadora y abrir un panel de detalle con su score, sus montos y su historial de cuotas sin cambiar de pantalla, para evaluar a un cliente rápidamente mientras reviso otra cosa.

**Why this priority**: Complementa la Historia 2 dando la vista centrada en el cliente (en vez del préstamo), útil para decisiones de negocio, pero no bloquea la operación diaria si el prestamista ya gestiona sus préstamos desde la Historia 2.

**Independent Test**: Con varios clientes en distintos estados de cartera, buscar por nombre o teléfono, aplicar cada filtro de estado y confirmar que la lista y su conteo coinciden; abrir el panel de detalle de un cliente y confirmar que su score, sus montos y su tabla de amortización más reciente se muestran correctamente — probable de forma aislada, sin depender de la Historia 2.

**Acceptance Scenarios**:

1. **Given** que tengo varios clientes en mi cartera, **When** busco por nombre parcial o teléfono, **Then** la lista se filtra a los clientes que coinciden.
2. **Given** el directorio completo, **When** aplico un filtro de estado ("Cobranza hoy", "Al día", "En mora"), **Then** la lista muestra solo esos clientes y el conteo del filtro coincide con la cantidad mostrada.
3. **Given** un cliente en la lista, **When** lo selecciono, **Then** se abre un panel de detalle con su score de confianza (letra + fracción), montos prestado/cobrado/saldo, y su tabla de amortización más reciente, sin navegar a otra URL.
4. **Given** el panel de detalle de un cliente con una cuota pendiente, **When** registro su cobro desde ahí, **Then** el cobro se guarda igual que en la Historia 2 y el panel refleja el cambio de inmediato.
5. **Given** una búsqueda que no coincide con ningún cliente, **When** reviso el resultado, **Then** veo un estado vacío que lo indica claramente en vez de una lista en blanco.

---

### User Story 4 - Cotizar y emitir un préstamo nuevo desde escritorio (Priority: P3)

Como prestamista, quiero cotizar un préstamo nuevo desde la computadora con los mismos controles y resultados que en la app móvil, y emitirlo ahí mismo, para poder atender una llamada o decidir un préstamo sin depender del teléfono.

**Why this priority**: Da paridad de funciones entre plataformas, pero la operación de campo (donde se cotiza frente al cliente) ya está cubierta por la app móvil desde la Fase 2; esta historia es conveniencia de escritorio, no una capacidad nueva del negocio.

**Independent Test**: Ajustar los parámetros de una simulación en la web y verificar que el total/cuota/tabla coinciden centavo a centavo con lo que produce la app móvil para los mismos parámetros, luego confirmar la emisión para un cliente nuevo o existente — probable de forma aislada, comparando ambas plataformas con la misma entrada.

**Acceptance Scenarios**:

1. **Given** que estoy en la calculadora de la web, **When** ajusto monto, tasa, plazo o frecuencia, **Then** el total a pagar, la cuota y la tabla completa se recalculan al instante, con los mismos valores que produciría la app móvil para la misma entrada.
2. **Given** una cotización calculada, **When** confirmo "Emitir este préstamo" y selecciono un cliente existente o capturo nombre y teléfono de uno nuevo, **Then** el préstamo se crea con sus cuotas ya generadas y aparece de inmediato en "Préstamos activos" (Historia 2) y en el directorio (Historia 3).

---

### Edge Cases

- **Cartera vacía**: si el prestamista no tiene ningún préstamo ni cliente todavía, el dashboard, la lista de préstamos y el directorio muestran cada uno un estado vacío claro, nunca una tabla en blanco ni un error de cálculo (ej. división por cero en cartera en mora).
- **Cobro simultáneo desde dos superficies**: si el prestamista (u otra persona con acceso al sistema) intenta registrar el cobro de la misma cuota desde la web y desde la app móvil al mismo tiempo, solo una de las dos operaciones debe completarse; la segunda debe fallar con un aviso claro de que la cuota ya fue cobrada, nunca duplicar el cobro.
- **Búsqueda o filtro sin resultados**: tanto en préstamos activos como en el directorio de clientes, una búsqueda o combinación de filtros sin coincidencias muestra un mensaje de "sin resultados", nunca una lista vacía sin explicación.
- **Exportar una lista vacía o filtrada**: exportar CSV cuando la búsqueda/filtro no tiene resultados produce un archivo válido pero sin filas de datos, no un error.
- **Cartera grande**: con una cantidad considerable de préstamos o clientes, las tablas deben poder mostrarse de forma utilizable (paginación o desplazamiento), sin que la pantalla deje de responder.
- **Pérdida de conexión durante un cobro o una emisión**: igual que en la app móvil (spec 001, FR-013), la web debe mostrar un aviso y no marcar la operación como completada hasta confirmar que se guardó.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La web DEBE mostrar un dashboard con el capital total prestado, el total recuperado, los intereses ganados y el monto de cartera en mora (con su conteo de cuotas y clientes afectados), todos derivados de los mismos datos de `prestamos`/`cuotas` que usa la app móvil.
- **FR-002**: La web DEBE listar los préstamos activos en una tabla buscable por nombre de cliente, teléfono o número de préstamo.
- **FR-003**: La web DEBE permitir abrir la tabla de amortización completa de un préstamo específico, mostrando todas sus cuotas (número, vencimiento, capital, interés, cuota total, saldo restante, estado) con filtros rápidos por "todas / pagadas / pendientes / vence hoy".
- **FR-004**: La web DEBE permitir registrar el cobro de una cuota pendiente o que vence hoy, tanto desde la tabla de amortización de un préstamo (Historia 2) como desde el panel de detalle de un cliente (Historia 3), reutilizando el mismo caso de uso de registro de cobro de `@repo/core` que usa la app móvil.
- **FR-005**: La web DEBE ofrecer un directorio de clientes buscable por nombre o teléfono, con filtros rápidos por estado de cartera (todos, cobranza hoy, al día, en mora) que muestren el conteo de clientes en cada uno.
- **FR-006**: Al seleccionar un cliente en el directorio, la web DEBE mostrar un panel de detalle con su score de confianza (letra + fracción, nunca solo la letra), sus montos prestado/cobrado/saldo, y su tabla de amortización más reciente, sin navegar a una pantalla distinta.
- **FR-007**: La web DEBE permitir exportar a un archivo descargable la lista actualmente visible de préstamos activos o de clientes, respetando la búsqueda y los filtros aplicados en ese momento.
- **FR-008**: La web DEBE permitir cotizar un préstamo nuevo ajustando monto, tasa, plazo y frecuencia con recálculo instantáneo, y emitirlo asociándolo a un cliente existente o a uno nuevo (mínimo nombre y teléfono), produciendo exactamente los mismos resultados que la app móvil para la misma entrada.
- **FR-009**: Todo cálculo financiero mostrado en la web (cuota, interés, totales, score de confianza) DEBE producirse exclusivamente a través de `@repo/core` — la web NO DEBE reimplementar ninguna fórmula de amortización ni de score.
- **FR-010**: `apps/web` NO DEBE importar un cliente de Supabase directamente fuera de su propia capa de datos; DEBE consumir las mismas interfaces (`ILoanRepository`, `IClientReader`, `IClientWriter`) que ya implementa la app móvil.
- **FR-011**: La web DEBE mostrar un estado vacío claro en el dashboard, en "Préstamos activos" y en el directorio cuando no haya datos o cuando una búsqueda/filtro no tenga resultados, en vez de una tabla o cifra en blanco.
- **FR-012**: Si se registra el cobro de la misma cuota desde la web y desde la app móvil de forma simultánea, el sistema DEBE garantizar que solo uno de los dos intentos se complete; el segundo DEBE fallar con un aviso claro en vez de duplicar el cobro.

### Key Entities *(include if feature involves data)*

- **Cliente, Préstamo, Cuota**: las mismas entidades definidas en el `spec.md` raíz y consumidas por `specs/001-mobile-field-app/`. Esta fase no cambia su forma ni añade columnas — solo las expone en nuevas vistas (dashboard, tabla de préstamos, directorio web).
- **Cartera (agregado)**: no es una entidad almacenada — es la vista derivada que resume todos los préstamos y cuotas del prestamista en las cuatro métricas del dashboard (capital prestado, recuperado, intereses ganados, mora). Se deriva en cada lectura, igual que el score de confianza (Principio IV de la constitución).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un prestamista puede ver el panorama completo de su cartera (capital prestado, recuperado, intereses ganados, mora) en menos de 5 segundos desde que abre el dashboard.
- **SC-002**: Un prestamista puede encontrar cualquier préstamo o cliente específico desde escritorio, por nombre, teléfono o número de préstamo, en menos de 10 segundos.
- **SC-003**: Un prestamista puede registrar el cobro de una cuota desde escritorio en menos de 30 segundos, igual que en la app móvil.
- **SC-004**: Un prestamista puede exportar su lista de préstamos activos o de clientes a un archivo descargable en menos de 5 segundos.
- **SC-005**: El 100% de los cálculos financieros mostrados en la web (cuota, interés, totales) coinciden exactamente, hasta el centavo, con los que muestra la app móvil para el mismo préstamo.
- **SC-006**: Dos intentos simultáneos de cobrar la misma cuota desde web y móvil producen exactamente un cobro registrado, nunca dos ni ninguno.

## Assumptions

- **Un solo prestamista administrador, sin autenticación** (consistente con el `spec.md` raíz y con `specs/001-mobile-field-app/`): esta fase no incluye login, roles ni permisos — la web es de acceso directo, igual que la app móvil.
- **Las métricas del dashboard son agregados derivados**, no columnas almacenadas — se calculan a partir de `prestamos`/`cuotas` (Principio IV de la constitución); la forma exacta de calcularlas (vista SQL, query agregada, etc.) es una decisión de implementación para `/speckit-plan`, no de esta especificación.
- **El registro de cobro reutiliza el mismo caso de uso y el mismo guard de concurrencia** ya implementados en `SupabaseLoanRepository` para la app móvil (spec 001, tarea T018) — esta fase no diseña un mecanismo de concurrencia nuevo, solo lo reutiliza desde una segunda superficie.
- **Alta de cliente nuevo desde la web es mínima** (nombre y teléfono), igual que en la app móvil — un flujo completo de onboarding sigue fuera de alcance (`spec.md` raíz §1).
- **Exportar es una descarga simple del listado visible** (ej. CSV); no incluye reportes programados, PDF ni envíos automáticos — eso corresponde a fases posteriores del roadmap de negocio (Fase 4, Gestión Operativa).
- **No se registran pagos parciales por cuota** en esta fase, misma exclusión que en `specs/001-mobile-field-app/` (FR-014) y en el `spec.md` raíz (§1).
- **No hay vista de mapa ni ruteo geográfico** en la web, consistente con la exclusión del `spec.md` raíz.
- **`apps/web` ya existe como scaffold** (Vite + TailwindCSS, puerto 5300, ver `spec.md` raíz §3 y §Fase 3) — esta fase construye la funcionalidad de producto sobre esa base, no la crea desde cero.
