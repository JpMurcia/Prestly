# Feature Specification: Auditoría de Consistencia con el Mockup Inicial

**Feature Branch**: `005-mockup-consistency-audit`

**Created**: 2026-09-04

**Status**: Draft

**Input**: User description: "valida el mockups todas las vista, colores, layaut y botones de las aplicación, que todo coincida con el mockups inicial"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Auditar pantallas móviles contra el mockup (Priority: P1)

Como responsable de calidad/diseño del producto, quiero revisar cada pantalla de la app móvil (`apps/mobile`) frente a su contraparte en el mockup inicial (`Docs/Plataforma Mockus/Microcreditos - Mockups.dc.html`), para confirmar que colores, tipografía, layout y botones coinciden, y para obtener una lista concreta de diferencias donde no coincidan.

**Why this priority**: La app móvil es el flujo operativo principal (cotización, cobranza en campo, directorio de clientes) y es donde vive la mayor cantidad de pantallas del mockup original (6 de 8). Validarla primero da la mayor cobertura de riesgo visual con el menor esfuerzo.

**Independent Test**: Puede probarse abriendo cada pantalla móvil listada en el mockup, comparándola visualmente campo a campo contra el artboard correspondiente, y verificando que el reporte de auditoría resultante cubre el 100% de esas pantallas con un veredicto (coincide / no coincide) y evidencia.

**Acceptance Scenarios**:

1. **Given** el mockup define la pantalla "Calculadora dinámica/avanzada de préstamos", **When** se compara contra `QuoteCalculatorScreen`, **Then** el reporte indica si los colores (fondo degradado verde del resumen, chips de parámetros, franja de acento), la tipografía (Plus Jakarta Sans para cifras destacadas, Inter para etiquetas) y los botones (alternador "Ver resumen/Ver tabla completa", "Compartir tabla por WhatsApp", "Emitir este préstamo") coinciden con el mockup, y detalla cualquier diferencia encontrada.
2. **Given** el mockup define "Directorio de clientes y cartera", **When** se compara contra `ClientDirectoryScreen`, **Then** el reporte confirma si la barra de búsqueda, los chips de filtro, y las filas de cliente (color, orden, espaciado) coinciden.
3. **Given** el mockup define "Perfil 360° del cliente" y "Préstamos activos · ruta de cobranza", **When** se comparan contra `ClientProfileScreen`, `LoanDetailScreen`, `RegisterPaymentModal` y `CollectionRouteScreen`, **Then** el reporte confirma si la fila de cobranza de 64px (barra de acento izquierda, sin relleno de fondo salvo "vence hoy"/mora) y las bandas de score de confianza (A+/A/B/C con sus colores) coinciden.

---

### User Story 2 - Auditar pantallas web contra el mockup (Priority: P2)

Como responsable de calidad/diseño del producto, quiero revisar las pantallas de `apps/web` frente a los artboards web del mockup inicial, para confirmar que el dashboard administrativo, la tabla de amortización y el CRM de clientes con su drawer coinciden en colores, layout y botones.

**Why this priority**: El panel web es usado por administradores para decisiones de cartera; sus discrepancias visuales son menos frecuentes (solo 2 de 8 artboards) pero igual de visibles para el negocio, por lo que se aborda después de cubrir la mayor superficie (móvil).

**Independent Test**: Puede probarse abriendo `DashboardPage`, `LoanAmortizationPage`, `ClientDirectoryPage` y `ClientDetailDrawer`, comparándolas contra los artboards "Dashboard administrativo y tabla de amortización extendida" y "CRM de clientes con drawer de amortización", y verificando que el reporte cubre el 100% de esos artboards.

**Acceptance Scenarios**:

1. **Given** el mockup define el "Dashboard administrativo y tabla de amortización extendida", **When** se compara contra `DashboardPage` y `LoanAmortizationPage`, **Then** el reporte indica si la estructura de layout (`AppShell`, tarjetas resumen, tabla) y la paleta (`#0F172A`, `#10B981`, `#1E3A8A`, fondos neutros) coinciden.
2. **Given** el mockup define el "CRM de clientes con drawer de amortización", **When** se compara contra `ClientDirectoryPage` y `ClientDetailDrawer`, **Then** el reporte indica si el layout del drawer, sus botones de acción y el formato tabular de cifras monetarias coinciden.

---

### User Story 3 - Reporte consolidado y priorización de correcciones (Priority: P3)

Como líder técnico, quiero un reporte único que consolide todas las discrepancias encontradas en móvil y web, clasificadas por severidad, para decidir qué corregir antes de continuar con nuevas funcionalidades y qué se puede posponer.

**Why this priority**: Consolidar y priorizar es el paso final que convierte la auditoría en un plan accionable; depende de que las Historias 1 y 2 ya hayan producido hallazgos.

**Independent Test**: Puede probarse revisando el documento consolidado y confirmando que cada discrepancia listada indica pantalla afectada, categoría (color / tipografía / layout / botón), severidad y referencia al artboard del mockup, sin necesidad de reabrir la app o el mockup para entender el hallazgo.

**Acceptance Scenarios**:

1. **Given** las auditorías de móvil y web ya se completaron, **When** se genera el reporte consolidado, **Then** cada hallazgo incluye pantalla, categoría, severidad (bloqueante / menor / cosmético) y una descripción reproducible de la diferencia.
2. **Given** el reporte consolidado existe, **When** un desarrollador lo lee, **Then** puede identificar sin ambigüedad qué archivo(s) de código corresponden a la pantalla señalada, usando el mapeo pantalla-mockup → componente de la app.

---

### Edge Cases

- ¿Qué ocurre con pantallas o funcionalidades de la app que no tienen artboard en el mockup inicial (p. ej. pagos parciales, liquidación anticipada, tendencia de cartera de la especificación 003, o los recordatorios automáticos de WhatsApp de la especificación 004)? El reporte debe señalarlas explícitamente como "sin mockup de referencia" en vez de omitirlas o inventar un veredicto de coincidencia.
- ¿Qué ocurre si un componente visual (por ejemplo botones o tarjetas) es compartido entre varias pantallas y aparece consistente en unas pero no en otras? El hallazgo debe registrarse una vez por componente compartido, listando todas las pantallas afectadas, en lugar de duplicarse por pantalla.
- ¿Qué ocurre si el mockup y la app muestran datos de ejemplo distintos (nombres, montos)? La comparación debe ignorar el contenido de ejemplo y enfocarse únicamente en estructura visual, color, tipografía y estilo de los controles.
- ¿Qué ocurre si una pantalla del mockup fue explícitamente reemplazada por una decisión de producto documentada (por ejemplo en `research.md` o `plan.md` de una especificación posterior)? Esa decisión documentada prevalece sobre el mockup, y el reporte debe citar la fuente en vez de marcarlo como discrepancia.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La auditoría MUST cubrir las 8 pantallas/artboards del mockup inicial (`Docs/Plataforma Mockus/Microcreditos - Mockups.dc.html`): calculadora de préstamos (1a/2a), detalle de cliente y registro de pago (1b), directorio de clientes (2b), perfil 360° del cliente (2c), préstamos activos/ruta de cobranza (2d), dashboard administrativo y amortización (1c), y CRM web con drawer (2e).
- **FR-002**: Para cada pantalla, la auditoría MUST verificar cuatro categorías: (a) paleta de colores (fondos, texto, acentos de estado, bandas de score), (b) tipografía (familia, peso, uso de `tabular-nums` en cifras monetarias), (c) layout (estructura, espaciado, radios de borde, jerarquía visual), y (d) botones/controles interactivos (etiqueta, jerarquía primaria/secundaria, iconografía, estado).
- **FR-003**: El sistema de reporte MUST registrar, por cada discrepancia encontrada, al menos: pantalla afectada, categoría, descripción de la diferencia, referencia al artboard del mockup (id de turno/opción, p. ej. "2a"), y el archivo o componente de código correspondiente.
- **FR-004**: El sistema de reporte MUST clasificar cada discrepancia con una severidad: bloqueante (contradice una decisión de marca/estado, p. ej. color de error usado para éxito), menor (desviación perceptible pero no confunde al usuario), o cosmético (detalle sutil de espaciado/sombra).
- **FR-005**: La auditoría MUST distinguir explícitamente las pantallas/elementos de la app que no tienen artboard correspondiente en el mockup inicial, marcándolos como "sin referencia" en vez de evaluarlos como coincidentes o no coincidentes.
- **FR-006**: La auditoría MUST tratar como fuente de verdad los tokens de diseño ya extraídos del mockup (`packages/ui/src/tokens/colors.ts`, `packages/ui/src/tokens/typography.ts`) al evaluar la categoría de color y tipografía, y MUST señalar si el código de una pantalla se desvía de esos tokens aunque visualmente luzca similar al mockup.
- **FR-007**: El reporte final MUST consolidarse en un único documento navegable que permita, para cada pantalla, ver su veredicto general (coincide / no coincide / sin referencia) sin necesidad de leer todos los hallazgos individuales.
- **FR-008**: La auditoría no MUST modificar código de la aplicación; su alcance es documentar hallazgos y dejar la corrección como trabajo de seguimiento posterior, salvo que el equipo decida lo contrario al revisar el reporte.

### Key Entities *(include if feature involves data)*

- **Pantalla auditada (Screen)**: Una vista de la aplicación (móvil o web) sujeta a comparación. Atributos: nombre, plataforma (móvil/web), componente(s) de código, artboard del mockup asociado (o "sin referencia"), veredicto general.
- **Hallazgo (Discrepancy)**: Una diferencia concreta entre el mockup y la implementación. Atributos: pantalla asociada, categoría (color/tipografía/layout/botón), descripción, severidad, referencia al artboard, archivo(s) de código afectado(s).
- **Reporte de auditoría (Audit Report)**: El documento consolidado que agrupa todas las pantallas y hallazgos, usado para decidir qué corregir.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de las 8 pantallas del mockup inicial quedan revisadas y documentadas con un veredicto (coincide / no coincide / sin referencia).
- **SC-002**: Cada discrepancia reportada puede ser localizada y reproducida por un desarrollador en menos de 5 minutos usando solo la información del reporte (sin tener que volver a inspeccionar el mockup para entender qué se comparó).
- **SC-003**: Un revisor de negocio puede determinar, leyendo únicamente el reporte consolidado, si la aplicación está lista para presentarse a stakeholders desde el punto de vista visual, sin abrir la app ni el mockup.
- **SC-004**: Cero discrepancias de severidad "bloqueante" quedan sin registrar al finalizar la auditoría (medido por una segunda pasada de verificación cruzada sobre las 8 pantallas).

## Assumptions

- El "mockup inicial" referido por el usuario es el archivo de diseño existente en `Docs/Plataforma Mockus/Microcreditos - Mockups.dc.html`, que contiene 8 artboards (3 del turno inicial "1a/1b/1c" y 5 de su ampliación "2a–2e"). No se identificó otro archivo de mockup en el repositorio.
- Los tokens de diseño ya documentados en `packages/ui/src/tokens/` (colores, tipografía) reflejan fielmente el mockup y sirven como referencia auxiliar verificable en código, además de la comparación visual directa contra el archivo de mockup.
- La auditoría es principalmente manual/visual (comparación humana pantalla a pantalla), no una herramienta automatizada de diffing de píxeles; se documenta como reporte legible, no como test automatizado.
- El criterio de "coincidencia" es de fidelidad de diseño (misma paleta, misma jerarquía tipográfica, mismo layout estructural y mismos controles/botones con su jerarquía visual), no una coincidencia exacta a nivel de píxel, dado que el mockup es una referencia de diseño y no una especificación de implementación pixel-perfect.
- Pantallas o funcionalidades agregadas en especificaciones posteriores sin artboard propio (pagos parciales, liquidación anticipada, tendencia de cartera, automatización de WhatsApp) quedan fuera del alcance de "coincidencia con el mockup" pero se listan como "sin referencia" para que el equipo decida si ameritan su propio mockup a futuro.
- El resultado esperado de esta especificación es un reporte de auditoría (documento), no la corrección inmediata del código; las correcciones encontradas se convierten en tareas de seguimiento fuera de este alcance.
