---

description: "Task list template for feature implementation"
---

# Tasks: Auditoría de Consistencia con el Mockup Inicial

**Input**: Design documents from `/specs/005-mockup-consistency-audit/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/audit-report-format.md, quickstart.md

**Tests**: No solicitados — esta auditoría es documental/manual (ver `plan.md` §Technical Context, Testing: N/A); no se generan tareas de test automatizado.

**Organization**: Las tareas se agrupan por historia de usuario (US1 móvil, US2 web, US3 reporte consolidado) para poder completarlas y validarlas de forma independiente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Se puede ejecutar en paralelo (archivos distintos, sin dependencias)
- **[Story]**: Historia de usuario a la que pertenece la tarea (US1, US2, US3)
- Todas las tareas de auditoría de pantalla escriben en el mismo `REPORT.md`, por lo que **no** se marcan `[P]` entre sí (evita condiciones de carrera sobre un mismo archivo), aunque la lectura/comparación de cada pantalla es independiente

## Path Conventions

Monorepo existente (no se crea código nuevo): `apps/mobile/src/`, `apps/web/src/`, `packages/ui/src/`, mockup en `Docs/Plataforma Mockus/Microcreditos - Mockups.dc.html`. El entregable vive en `specs/005-mockup-consistency-audit/REPORT.md`.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Preparar el esqueleto del entregable antes de auditar ninguna pantalla

- [X] T001 Crear `specs/005-mockup-consistency-audit/REPORT.md` con la estructura exacta de `contracts/audit-report-format.md`: encabezado (fecha, mockup de referencia, cobertura), tabla "Resumen ejecutivo" pre-poblada con las 11 filas del catálogo de `data-model.md` (columnas pantalla/plataforma/artboard(s), veredicto en blanco/"pendiente"), un stub de sección `### [id-pantalla]` por cada una de las 7 pantallas con artboard, un stub `### shared-button`, y las tablas vacías de "Pantallas sin mockup de referencia" y "Priorización sugerida"

**Checkpoint**: `REPORT.md` existe con la forma correcta; listo para llenarse pantalla por pantalla

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Obtener la referencia compartida (botón primitivo + tokens) que todas las auditorías de pantalla necesitan citar por FR-006

**⚠️ CRITICAL**: Ninguna auditoría de pantalla (US1/US2) debe comenzar hasta que estas tareas estén completas, porque cada hallazgo de color/tipografía/botón debe poder citar esta referencia

- [X] T002 Auditar el componente compartido `Button` (`packages/ui/src/primitives/Button.tsx` y `packages/ui/src/primitives-web/Button.tsx`) contra el tratamiento de botones observado en los 8 artboards del mockup (verde sólido `#10B981` para acción primaria tipo "Emitir"/"Registrar cobro", borde neutro `#E2E8F0` para acciones secundarias tipo "Compartir"); registrar el veredicto y cualquier hallazgo en la sección `### shared-button` de `REPORT.md`, listando en `Pantallas donde se usa` cada pantalla del catálogo que renderiza un `Button`
- [X] T003 [P] Confirmar y anotar en `REPORT.md` (como nota bajo el encabezado, antes del resumen ejecutivo) los valores exactos de referencia de `packages/ui/src/tokens/colors.ts` (paleta `emerald #10B981`, `navy #1E3A8A`, `ink #0F172A`, estados `alDia/cobroHoy/mora`, bandas de score `aPlus/a/b/c`, neutros) y de `packages/ui/src/tokens/typography.ts` (`Plus Jakarta Sans` para cifras/títulos, `Inter` para cuerpo, `tabular-nums` obligatorio en montos) que se usarán como oráculo auxiliar en cada auditoría de pantalla

**Checkpoint**: Referencia de botón y tokens lista y citable — puede comenzar la auditoría de pantallas en paralelo por historia

---

## Phase 3: User Story 1 - Auditar pantallas móviles contra el mockup (Priority: P1) 🎯 MVP

**Goal**: Cada una de las 6 pantallas/componentes móviles queda comparada contra su artboard (o marcada "sin referencia"), con hallazgos de color/tipografía/layout/botón registrados en `REPORT.md`

**Independent Test**: Abrir `REPORT.md` y confirmar que las secciones de las 6 pantallas móviles (`mobile-quote-calculator`, `mobile-client-detail-payment`, `mobile-client-directory`, `mobile-client-360-profile`, `mobile-collection-route`, `mobile-issue-loan-sheet`) tienen veredicto y, si aplica, hallazgos con severidad — sin haber tocado ninguna pantalla web todavía

### Implementation for User Story 1

- [X] T004 [US1] Auditar `mobile-quote-calculator` (artboards `1a`, `2a`) vs `apps/mobile/src/screens/QuoteCalculatorScreen.tsx`: verificar degradado verde del resumen (`#10B981`→`#059669`), chips de parámetros, alternador "Ver resumen/Ver tabla completa", tabla de amortización con `tabular-nums`, botones "Compartir tabla por WhatsApp" y "Emitir este préstamo"; registrar veredicto y hallazgos en `REPORT.md`
- [X] T005 [US1] Auditar `mobile-client-detail-payment` (artboard `1b`) vs `apps/mobile/src/screens/LoanDetailScreen.tsx` y `apps/mobile/src/components/RegisterPaymentModal.tsx`: verificar layout de detalle de cliente y el flujo/controles de registro de pago; registrar veredicto y hallazgos en `REPORT.md`
- [X] T006 [US1] Auditar `mobile-client-directory` (artboard `2b`) vs `apps/mobile/src/screens/ClientDirectoryScreen.tsx`: verificar barra de búsqueda, chips de filtro ("Todos · 24", etc.) y filas de cliente (color, orden, espaciado); registrar veredicto y hallazgos en `REPORT.md`
- [X] T007 [US1] Auditar `mobile-client-360-profile` (artboard `2c`) vs `apps/mobile/src/screens/ClientProfileScreen.tsx`: verificar bandas de score de confianza A+/A/B/C con sus colores (`#ECFDF5`/`#047857`, etc.) y cifras tabulares; registrar veredicto y hallazgos en `REPORT.md`
- [X] T008 [US1] Auditar `mobile-collection-route` (artboard `2d`) vs `apps/mobile/src/screens/CollectionRouteScreen.tsx`: verificar la fila de cobranza de 64px (barra de acento izquierda `#F59E0B`, sin relleno de fondo salvo "vence hoy"/mora) y que el fondo tintado se reserve solo para esos estados; registrar veredicto y hallazgos en `REPORT.md`
- [X] T009 [US1] Documentar `mobile-issue-loan-sheet` (sin artboard propio) — `apps/mobile/src/components/IssueLoanSheet.tsx` — en la tabla "Pantallas sin mockup de referencia" de `REPORT.md`, sin asignarle veredicto de coincidencia

**Checkpoint**: Las 6 entradas móviles de `REPORT.md` tienen veredicto (o están correctamente marcadas "sin referencia"); User Story 1 es demostrable de forma independiente

---

## Phase 4: User Story 2 - Auditar pantallas web contra el mockup (Priority: P2)

**Goal**: Las 2 pantallas web con mockup (más las 3 sin referencia) quedan comparadas y documentadas en `REPORT.md`

**Independent Test**: Abrir `REPORT.md` y confirmar que las secciones web (`web-dashboard-amortization`, `web-client-crm-drawer`, y las 3 "sin referencia") tienen veredicto/documentación, independientemente de si la Historia 1 ya se completó

### Implementation for User Story 2

- [X] T010 [US2] Auditar `web-dashboard-amortization` (artboard `1c`) vs `apps/web/src/pages/DashboardPage.tsx` y `apps/web/src/pages/LoanAmortizationPage.tsx`: verificar estructura de `AppShell`, tarjetas resumen, tabla de amortización extendida y paleta (`#0F172A`, `#10B981`, `#1E3A8A`, fondos neutros); registrar veredicto y hallazgos en `REPORT.md`
- [X] T011 [US2] Auditar `web-client-crm-drawer` (artboard `2e`) vs `apps/web/src/pages/ClientDirectoryPage.tsx` y `apps/web/src/components/ClientDetailDrawer.tsx`: verificar layout del drawer, sus botones de acción y el formato tabular de cifras monetarias; registrar veredicto y hallazgos en `REPORT.md`
- [X] T012 [US2] Documentar `web-quote-calculator` (`apps/web/src/pages/QuoteCalculatorPage.tsx`), `web-active-loans` (`apps/web/src/pages/ActiveLoansPage.tsx`) y `web-whatsapp-config` (`apps/web/src/pages/WhatsAppConfigPage.tsx`) — sin artboard propio — en la tabla "Pantallas sin mockup de referencia" de `REPORT.md`

**Checkpoint**: Las 5 entradas web de `REPORT.md` (2 con mockup + 3 sin referencia) están completas; User Stories 1 y 2 son ambas demostrables

---

## Phase 5: User Story 3 - Reporte consolidado y priorización de correcciones (Priority: P3)

**Goal**: `REPORT.md` queda cerrado como documento único navegable, con el resumen ejecutivo, conteos por severidad, y una lista de correcciones priorizada

**Independent Test**: Un lector que no participó en la auditoría puede abrir solo la tabla "Resumen ejecutivo" y la sección "Priorización sugerida" y entender, sin más contexto, qué corregir primero

### Implementation for User Story 3

- [X] T013 [US3] Completar la columna "Veredicto" de la tabla "Resumen ejecutivo" en `REPORT.md` para las 11 pantallas usando los resultados de T004–T012, y calcular los contadores "Hallazgos bloqueantes/menores/cosméticos" del encabezado del reporte
- [X] T014 [US3] Escribir la sección "Priorización sugerida" en `REPORT.md`: listar todos los hallazgos ordenados primero por severidad (bloqueante → menor → cosmético) y luego por pantalla, citando pantalla + descripción breve para cada uno
- [X] T015 [US3] Ejecutar la lista de validación de `quickstart.md` (SC-001 a SC-004) contra el `REPORT.md` terminado y anotar el resultado de cada verificación al final del reporte (o corregir el reporte si alguna falla)

**Checkpoint**: Las tres historias de usuario están completas; `REPORT.md` es el entregable final de la auditoría

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Cerrar la auditoría asegurando que cumple sus restricciones (FR-008) y su formato (contrato)

- [X] T016 Ejecutar `git status` y confirmar que ningún archivo fuera de `specs/005-mockup-consistency-audit/` fue modificado durante la auditoría, conforme a FR-008
- [X] T017 Revisar `REPORT.md` completo contra `contracts/audit-report-format.md` para confirmar terminología consistente (`coincide`/`no_coincide`/`sin_referencia`, severidades `bloqueante`/`menor`/`cosmético`) y que ninguna fila de hallazgo carezca de referencia de artboard o de archivo de código

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sin dependencias — puede iniciar de inmediato
- **Foundational (Phase 2)**: Depende de Setup — bloquea todas las historias de usuario
- **User Story 1 (Phase 3)**: Depende de Foundational; sin dependencia de US2/US3
- **User Story 2 (Phase 4)**: Depende de Foundational; sin dependencia de US1 (puede ejecutarse en paralelo por otra persona)
- **User Story 3 (Phase 5)**: Depende de que US1 y US2 hayan producido veredictos/hallazgos que consolidar
- **Polish (Phase 6)**: Depende de que US3 haya cerrado el reporte

### Parallel Opportunities

- T003 (anotar tokens de referencia) puede hacerse en paralelo a T002 (auditar el botón compartido), ya que son lecturas de archivos distintos aunque ambas escriban en `REPORT.md` en secciones distintas (encabezado vs. `shared-button`)
- Una vez cerrado Phase 2, un segundo auditor puede tomar Phase 4 (US2, web) mientras el primero continúa con Phase 3 (US1, móvil) — ambas fases son independientes entre sí, aunque conviene coordinar quién edita `REPORT.md` en cada momento para no pisar ediciones
- Dentro de cada fase, las tareas de auditoría de pantalla (T004–T008, T010–T012) son independientes en su lectura/comparación, pero se ejecutan una por una en la práctica porque todas escriben el mismo `REPORT.md`

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Completar Phase 1: Setup (`REPORT.md` con esqueleto)
2. Completar Phase 2: Foundational (referencia de botón + tokens)
3. Completar Phase 3: User Story 1 (las 6 pantallas móviles)
4. **Detener y validar**: `REPORT.md` ya es útil por sí solo — cubre el flujo operativo principal (móvil) aunque falte web
5. Continuar con US2 y US3 para cerrar el 100% de cobertura exigido por SC-001

### Incremental Delivery

1. Setup + Foundational → esqueleto y referencia listos
2. US1 (móvil) → `REPORT.md` cubre 6/11 pantallas → valor entregado de inmediato al equipo móvil
3. US2 (web) → `REPORT.md` cubre 11/11 pantallas → cobertura completa (SC-001)
4. US3 (consolidación) → `REPORT.md` queda priorizado y listo para decidir qué corregir (SC-002/SC-003)
5. Polish → confirma que no se tocó código de la app (FR-008) y que el formato es consistente

---

## Notes

- No hay tareas `[P]` entre auditorías de pantalla porque todas escriben el mismo `REPORT.md`; el paralelismo real está entre historias completas (US1 vs. US2), no entre tareas individuales de una misma historia
- Cada tarea de auditoría de pantalla debe seguir el formato de hallazgo fijado en `contracts/audit-report-format.md` (categoría, severidad, descripción, referencia de artboard, archivo)
- Ninguna tarea de esta lista modifica código de `apps/mobile`, `apps/web` o `packages/ui` — todas son de lectura y documentación (FR-008)
- Al completar cada tarea, hacer commit del progreso en `REPORT.md` como grupo lógico (p. ej. un commit por pantalla o por fase), no como una sola entrega al final
