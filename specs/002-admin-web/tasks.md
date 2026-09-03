---

description: "Task list template for feature implementation"
---

# Tasks: Admin Web — Dashboard y Gestión de Cartera

**Input**: Design documents from `/specs/002-admin-web/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Se incluyen tareas de test. Para `packages/data-supabase` (mapeo fila↔dominio de código que mueve dinero) y para `apps/web` (un test de integración por historia de usuario, alineado con los escenarios de `quickstart.md`) — mismo criterio ya usado en `specs/001-mobile-field-app/tasks.md`. `packages/core` no gana lógica de cálculo nueva en esta fase (solo tipos/firmas), así que no requiere un test Jest nuevo bajo la constitución, principio III.

**Organization**: Las tareas están agrupadas por historia de usuario para poder implementarlas y probarlas de forma independiente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: A qué historia de usuario pertenece (US1, US2, US3, US4)
- Cada tarea incluye la ruta de archivo exacta

## Path Conventions

Monorepo Turborepo existente — rutas relativas a la raíz del repo, según `plan.md` §Project Structure:

- `apps/web/src/` — páginas, layout, router, hooks, capa de datos de la web
- `packages/core/src/` — interfaces del motor financiero (extendidas por esta fase, sin nueva lógica de cálculo)
- `packages/data-supabase/src/` — NUEVO paquete: implementación concreta de `ILoanRepository`/`IClientReader`/`IPortfolioReader` contra Supabase, extraída de `apps/mobile/src/data/` y compartida con `apps/web`
- `packages/ui/src/` — primitivas web nuevas, tokens ya existentes reutilizados
- `apps/mobile/src/data/` — se refactoriza para consumir `@repo/data-supabase` en vez de sus copias locales
- `supabase/` — nueva migración (`0003_cartera_resumen.sql`)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: preparar el paquete nuevo, las dependencias y la estructura de carpetas que el resto de fases necesita, sin tocar lógica de producto todavía.

- [X] T001 [P] Crear `packages/data-supabase/package.json` (`name: "@repo/data-supabase"`, `type: "module"`, config de Jest idéntica a `packages/core/package.json`) y `packages/data-supabase/tsconfig.json`
- [X] T002 [P] Crear estructura de carpetas `packages/data-supabase/src/` y `packages/data-supabase/__tests__/`
- [X] T003 [P] Crear estructura de carpetas `packages/ui/src/primitives-web/` y archivo placeholder `packages/ui/src/web.ts`; actualizar `packages/ui/package.json` `"exports"` para añadir `"./web": "./src/web.ts"` (análogo a `"./native"`)
- [X] T004 [P] Añadir dependencias a `apps/web/package.json`: `react-router-dom`, `@tanstack/react-query`, `@repo/data-supabase` (`*`); devDependencies `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`; correr `npm install`
- [X] T005 [P] Configurar Vitest en `apps/web` (bloque `test` en `vite.config.ts` con `environment: 'jsdom'`, o `vitest.config.ts` separado) con script `"test": "vitest run"` para que `npm test --workspace=web` funcione
- [ ] T006 [P] Crear `apps/web/.env.example` con `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` (placeholders), análogo a `apps/mobile/.env.example` (research.md §6) — **BLOQUEADO**: regla de permisos de este entorno deniega escribir archivos `.env*`; pendiente de que el usuario lo cree a mano
- [X] T007 [P] Crear estructura de carpetas `apps/web/src/{layout,pages,components,hooks,data}/` y `apps/web/__tests__/`, con un `router.tsx` vacío como placeholder

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: extraer sin duplicar la capa de datos que `apps/mobile` ya construyó, extender `@repo/core` con la superficie mínima que falta, y levantar el sistema de diseño web + el shell de navegación — nada de esto existe todavía y **todas** las historias de usuario dependen de esto.

**⚠️ CRITICAL**: ninguna historia de usuario puede empezar hasta que esta fase esté completa.

### Base de datos

- [X] T008 Crear `supabase/migrations/0003_cartera_resumen.sql` con la `VIEW cartera_resumen` exacta de `data-model.md` — sin modificar ninguna tabla, tipo ni función existente

### `@repo/core` — extensión de interfaces (sin nueva lógica de cálculo)

- [X] T009 [P] Extender `packages/core/src/interfaces/index.ts`: añadir `ActiveLoanSummary` y el método `listActive()` a `ILoanRepository`; añadir `PortfolioSummary` e `IPortfolioReader` — firmas exactas de `contracts/core-interfaces.md`

### `packages/data-supabase` — extracción + extensión (NUEVO paquete, Test-First para el mapeo fila↔dominio)

- [X] T010 [P] Implementar `packages/data-supabase/src/createSupabaseClient.ts`: función factoría `createSupabaseClient(url, anonKey)` que envuelve `createClient` de `@supabase/supabase-js` (`auth: { persistSession: false }`) — sin leer `process.env` directamente (research.md §6) — depende de T001, T002
- [X] T011 [P] Escribir `packages/data-supabase/__tests__/SupabaseClientRepository.test.ts` (mock de `SupabaseClient`) cubriendo el mapeo fila→dominio de `toClient`/`computePortfolio` ya existente en `apps/mobile/src/data/SupabaseClientRepository.ts` — debe fallar antes de T013
- [X] T012 [P] Escribir `packages/data-supabase/__tests__/SupabaseLoanRepository.test.ts` (mock de `SupabaseClient`) cubriendo el mapeo fila→dominio existente y el nuevo método `listActive()` (join préstamo+cliente, `contracts/data-contract.md` §US2) — debe fallar antes de T014
- [X] T013 [P] Mover `apps/mobile/src/data/SupabaseClientRepository.ts` a `packages/data-supabase/src/SupabaseClientRepository.ts`, refactorizando a inyección por constructor en vez de importar un singleton de módulo — hace pasar T011; depende de T010, T011 (asignación explícita en el cuerpo del constructor, no propiedad de parámetro — `apps/web` compila con `erasableSyntaxOnly`)
- [X] T014 [P] Mover `apps/mobile/src/data/SupabaseLoanRepository.ts` a `packages/data-supabase/src/SupabaseLoanRepository.ts` con el mismo refactor de inyección por constructor, e implementar el nuevo método `listActive()` — hace pasar T012; depende de T009, T010, T012
- [X] T015 [P] Escribir `packages/data-supabase/__tests__/SupabasePortfolioReader.test.ts` (mock de `SupabaseClient`) cubriendo el mapeo de `cartera_resumen` a `PortfolioSummary` — debe fallar antes de T016
- [X] T016 [P] Implementar `packages/data-supabase/src/SupabasePortfolioReader.ts` (`IPortfolioReader` contra `VIEW cartera_resumen`) — hace pasar T015; depende de T008, T009, T010, T015
- [X] T017 Crear `packages/data-supabase/src/index.ts` exportando `createSupabaseClient`, `SupabaseClientRepository`, `SupabaseLoanRepository`, `SupabasePortfolioReader`, `InstallmentAlreadyPaidError` — depende de T013, T014, T016
- [X] T018 Actualizar `apps/mobile/src/data/repositories.ts` para instanciar `clientRepository`/`loanRepository` desde `@repo/data-supabase` (`createSupabaseClient(EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY)`); eliminar `apps/mobile/src/data/supabaseClient.ts`, `SupabaseLoanRepository.ts` y `SupabaseClientRepository.ts` (movidos, no duplicados); verificar que `npm test --workspace=mobile` sigue pasando sin cambios de comportamiento — depende de T017 — **verificado: 4 suites / 10 tests pasan, sin cambios**
- [X] T019 [P] Crear `apps/web/src/data/repositories.ts` instanciando `clientRepository`/`loanRepository`/`portfolioReader` desde `@repo/data-supabase` (`createSupabaseClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)`) — depende de T017, T006

### Sistema de diseño web y navegación compartida

- [X] T020 [P] Implementar primitivas en `packages/ui/src/primitives-web/` (`Button.tsx`, `Card.tsx`, `Badge.tsx`, `ProgressBar.tsx`, `Chip.tsx`, `Avatar.tsx`) con DOM + clases Tailwind, consumiendo los mismos tokens que `./native` (`packages/ui/src/tokens/colors.ts`, `typography.ts`); tokens de color propios (`brand-emerald`/`navy`/`ink`) añadidos vía `@theme` en `apps/web/src/index.css` (Tailwind v4) — depende de T003
- [X] T021 Actualizar `packages/ui/src/web.ts` para exportar las primitivas de T020 como contrato público del entry point `@repo/ui/web` — depende de T020
- [X] T022 Construir `apps/web/src/router.tsx` con las rutas `/` (dashboard), `/prestamos`, `/prestamos/:id`, `/clientes`, `/calculadora` (elementos placeholder por ahora) — depende de T007
- [X] T023 Construir `apps/web/src/layout/AppShell.tsx` (barra lateral fija 232px con navegación + slot de contenido, per mockups 1c/2e) usando `@repo/ui/web` — depende de T021, T022
- [X] T024 Actualizar `apps/web/src/App.tsx` para montar `RouterProvider` (`createBrowserRouter`, API de datos de react-router 7 — equivalente moderno a `BrowserRouter`) + `QueryClientProvider` (TanStack Query), reemplazando el placeholder actual — depende de T022, T023

**Checkpoint**: fundación lista — `@repo/data-supabase` existe y `apps/mobile` lo consume sin romperse, `@repo/core` expone `listActive`/`IPortfolioReader`, hay sistema de diseño web y navegación. Las historias de usuario pueden empezar.

---

## Phase 3: User Story 1 - Ver el panorama financiero desde el dashboard (Priority: P1)

**Goal**: el prestamista abre el dashboard y ve capital prestado, total recuperado, intereses ganados y cartera en mora, siempre actualizados.

**Independent Test**: con una cartera que tenga préstamos en distintos estados, abrir el dashboard y verificar que las cuatro métricas coinciden con la suma real de los préstamos/cuotas subyacentes.

### Tests for User Story 1

- [X] T025 [P] [US1] Escribir `apps/web/__tests__/DashboardPage.test.tsx` cubriendo los escenarios de aceptación 1 y 3 de spec.md (las cuatro métricas se muestran; mora en $0 cuando no hay cuotas vencidas) — debe fallar antes de T027

### Implementation for User Story 1

- [X] T026 [US1] Implementar `apps/web/src/hooks/useDashboardSummary.ts` (TanStack Query envolviendo `IPortfolioReader.getSummary`) — depende de T019
- [X] T027 [US1] Construir `apps/web/src/pages/DashboardPage.tsx`: cuatro tarjetas de métricas (capital prestado, recuperado, intereses ganados, cartera en mora) per mockup 1c — hace pasar T025; depende de T026, T021
- [X] T028 [US1] Registrar `DashboardPage` como elemento de la ruta `"/"` en `router.tsx` — depende de T022, T027

**Checkpoint**: User Story 1 funciona de forma completa e independiente.

---

## Phase 4: User Story 2 - Gestionar préstamos activos y registrar cobros desde escritorio (Priority: P1)

**Goal**: el prestamista ve sus préstamos activos, abre la tabla de amortización de cualquiera y registra un cobro sin salir de la pantalla.

**Independent Test**: con un préstamo que tenga cuotas pendientes, abrir su tabla de amortización desde la lista de préstamos activos, registrar el cobro de la cuota que vence hoy, y confirmar que pasa a "pagado" y desaparece de los pendientes.

### Tests for User Story 2

- [X] T029 [P] [US2] Escribir `apps/web/__tests__/ActiveLoansPage.test.tsx` cubriendo los escenarios de aceptación 1 y 5 de spec.md (lista buscable, estado vacío) — debe fallar antes de T032
- [X] T030 [P] [US2] Escribir `apps/web/__tests__/LoanAmortizationPage.test.tsx` cubriendo los escenarios de aceptación 2 y 3 (tabla completa con filtros; registrar cobro actualiza saldo y estado) — debe fallar antes de T034

### Implementation for User Story 2

- [X] T031 [US2] Implementar `apps/web/src/hooks/useActiveLoans.ts` (TanStack Query envolviendo `ILoanRepository.listActive`) — depende de T019
- [X] T032 [US2] Construir `apps/web/src/pages/ActiveLoansPage.tsx`: tabla superior de préstamos activos, buscador por cliente/teléfono/número de préstamo, estado vacío per mockup 1c — hace pasar T029; depende de T031, T021
- [X] T033 [US2] Implementar `apps/web/src/hooks/useLoanAmortization.ts` (TanStack Query envolviendo `ILoanRepository.findById`) y `apps/web/src/hooks/useRegisterPayment.ts` (mutación envolviendo `markInstallmentPaid`, invalida dashboard/préstamos activos/directorio per FR-004/FR-009-equivalente) — depende de T019, T026, T031
- [X] T034 [US2] Construir `apps/web/src/pages/LoanAmortizationPage.tsx`: tabla de amortización completa con filtros "todas/pagadas/pendientes/vence hoy" y botón "Registrar" por fila pendiente/vence-hoy per mockup 1c — hace pasar T030; depende de T033, T021
- [X] T035 [US2] Implementar `apps/web/src/components/ExportCsvButton.tsx` (serialización manual + descarga vía `Blob`, FR-007) e integrarlo en `ActiveLoansPage` — depende de T032
- [X] T036 [US2] Registrar `ActiveLoansPage` en `"/prestamos"` y `LoanAmortizationPage` en `"/prestamos/:id"` en `router.tsx` — depende de T022, T032, T034

**Checkpoint**: User Story 1 y 2 (el MVP completo de esta fase) funcionan de forma independiente.

---

## Phase 5: User Story 3 - Consultar el directorio de clientes con vista 360° desde escritorio (Priority: P2)

**Goal**: el prestamista busca y filtra su cartera de clientes y abre un panel de detalle sin cambiar de pantalla.

**Independent Test**: con varios clientes en distintos estados, buscar por nombre/teléfono, aplicar cada filtro de estado, y abrir el panel de detalle de un cliente verificando su score, montos y tabla de amortización más reciente.

### Tests for User Story 3

- [X] T037 [P] [US3] Escribir `apps/web/__tests__/ClientDirectoryPage.test.tsx` cubriendo los escenarios de aceptación 1, 2, 3 y 5 de spec.md (búsqueda, filtros con conteo, panel de detalle, sin resultados) — debe fallar antes de T040

### Implementation for User Story 3

- [X] T038 [US3] Implementar `apps/web/src/hooks/useClientDirectory.ts` (TanStack Query envolviendo `IClientReader.list(filter)`) — depende de T019
- [X] T039 [US3] Implementar `apps/web/src/hooks/useClientDetail.ts` (combina `IClientReader.findById` + `getScore` + `ILoanRepository.listByClient` para el drawer, `contracts/data-contract.md` §US3) — depende de T019
- [X] T040 [US3] Construir `apps/web/src/pages/ClientDirectoryPage.tsx`: tabla de clientes, buscador, chips de filtro por estado con conteo, estado vacío per mockup 2e — hace pasar T037; depende de T038, T021 (el filtro de estado y su conteo se calculan en memoria sobre el resultado de búsqueda, no como 4 consultas separadas)
- [X] T041 [US3] Construir `apps/web/src/components/ClientDetailDrawer.tsx`: panel lateral con score+fracción, montos prestado/saldo, mini-tabla de amortización, botón "Registrar cobro $X" (reutiliza `useRegisterPayment` de T033) per mockup 2e — depende de T039, T033, T021
- [X] T042 [US3] Integrar `ExportCsvButton` (T035) en `ClientDirectoryPage` — depende de T035, T040
- [X] T043 [US3] Registrar `ClientDirectoryPage` en `"/clientes"` en `router.tsx` — depende de T022, T040

**Checkpoint**: User Story 1, 2 y 3 funcionan de forma independiente.

---

## Phase 6: User Story 4 - Cotizar y emitir un préstamo nuevo desde escritorio (Priority: P3)

**Goal**: el prestamista cotiza y emite un préstamo desde la web con los mismos resultados que la app móvil.

**Independent Test**: ajustar los parámetros de una simulación en la web y verificar que coinciden centavo a centavo con la app móvil para la misma entrada; confirmar la emisión para un cliente nuevo o existente.

### Tests for User Story 4

- [X] T044 [P] [US4] Escribir `apps/web/__tests__/QuoteCalculatorPage.test.tsx` cubriendo los escenarios de aceptación 1 y 2 de spec.md (recálculo instantáneo con los mismos valores que móvil; emisión) — debe fallar antes de T046
- [X] T045 [US4] Implementar `apps/web/src/hooks/useIssueLoan.ts` (mutación TanStack Query envolviendo `issueLoan` de `@repo/core`, invalida préstamos activos/directorio/dashboard) — depende de T019, T026, T031, T038
- [X] T046 [US4] Construir `apps/web/src/pages/QuoteCalculatorPage.tsx`: controles de monto/tasa/plazo/frecuencia, tabla completa, flujo "Emitir este préstamo" (toggle cliente nuevo/existente — búsqueda vía `useClientDirectory`) — reutiliza `quoteLoan`/`issueLoan` de `@repo/core`, misma paridad que `QuoteCalculatorScreen` de `apps/mobile` — hace pasar T044; depende de T045, T021
- [X] T047 [US4] Registrar `QuoteCalculatorPage` en `"/calculadora"` en `router.tsx` — depende de T022, T046

**Checkpoint**: las 4 historias de usuario funcionan de forma independiente.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: mejoras que afectan a varias historias, verificación de la reutilización sin duplicar, y cierre de la feature.

- [X] T048 [P] Ejecutar `npx supabase db reset` y recorrer manualmente `quickstart.md` de punta a punta (las 4 historias), incluida la validación de concurrencia web+móvil (FR-012/SC-006: cobrar la misma cuota desde ambas superficies a la vez) — **hecho**: Docker/Supabase CLI sí están disponibles en este entorno (nota anterior obsoleta). `npx supabase db reset` aplicó `0003_cartera_resumen.sql` contra Postgres real sin errores. Recorrido manual completo vía `apps/web` contra la base local (US1-US4: dashboard, préstamos activos + cobro, directorio + drawer + cobro, calculadora + emisión — caso de referencia $500/15%/12 semanal reproducido exacto: $47.92/$75.00/$575.00) y validación de FR-012/SC-006 disparando dos llamadas RPC `registrar_cobro` concurrentes a la misma cuota (script ad-hoc contra `@supabase/supabase-js`, mismo procedimiento que usan ambas superficies) — exactamente 1 éxito y 1 `P0001`/`InstallmentAlreadyPaidError`, sin duplicar el cobro. Se encontraron y corrigieron 2 bugs reales que los tests con mocks no podían atrapar: (1) `cartera_resumen` sumaba `capital` sobre el `JOIN` a `cuotas` (fan-out uno-a-muchos) — un préstamo de $500 a 12 cuotas mostraba "capital prestado" = $6,000; corregido en `supabase/migrations/0003_cartera_resumen.sql` y `data-model.md` agregando `capital_prestado` en una subconsulta independiente sobre `prestamos`, sin pasar por el join. (2) `fecha_vencimiento`/`fecha_emision` (columnas `DATE`, sin huso horario) se parseaban con `new Date(dateOnlyString)`, que ECMAScript interpreta como medianoche UTC — en cualquier huso detrás de UTC (America/Bogota, UTC-5, y toda Latinoamérica/`es-DO`) esto mostraba un día antes al formatear en hora local (una cuota con vencimiento 10/9 se veía como 9/9 tras recargar). Corregido con `packages/data-supabase/src/dateOnly.ts` (`toDateOnly`/`fromDateOnly`, ambas basadas en getters locales, nunca UTC), aplicado en `SupabaseLoanRepository.ts` y `SupabaseClientRepository.ts`; afecta a `apps/mobile` también (código compartido) — regresión cubierta por `packages/data-supabase/__tests__/dateOnly.test.ts` (4 tests nuevos). Suite completa (`npm run test`, 4 paquetes) sigue en verde tras ambos fixes.
- [X] T049 [P] Pasada de lint (`turbo run lint`) consistente en `apps/web`, `packages/data-supabase`, `packages/ui`, `packages/core` — **0 warnings, 0 errors** en los 4 paquetes (se corrigieron 2 warnings encontrados: `exhaustive-deps` en `ClientDirectoryPage.tsx` y `no-thenable` en un test helper)
- [X] T050 Verificar que `apps/mobile` sigue pasando sus tests y su flujo manual sin cambios de comportamiento tras el refactor de la Fase 2 (regresión de T018) — **verificado repetidamente**: 4 suites / 10 tests, type-check limpio, sin cambios de comportamiento
- [X] T051 [P] Revisión visual contra las convenciones de los mockups 1c/2e (cifras `tabular-nums`, sistema de color de estado, barra lateral 232px) en `DashboardPage.tsx`, `ActiveLoansPage.tsx`, `LoanAmortizationPage.tsx`, `ClientDirectoryPage.tsx` y `QuoteCalculatorPage.tsx` — verificado en navegador con credenciales dummy (sin backend real disponible en este entorno): `QuoteCalculatorPage` reproduce el caso de referencia exacto ($47.92/$75.00/$575.00, mismo que la app móvil); AppShell, navegación, filtros y estados vacíos renderizan correctamente sin errores de React (solo 401 de red, esperado sin backend real)
- [X] T052 Actualizar el Anexo de `spec.md` (raíz del repo) marcando "Admin Web" (Fase 3 del negocio) como entregada, una vez T048 pase sin hallazgos — **hecho**, ver Anexo de `spec.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias — puede arrancar de inmediato
- **Foundational (Phase 2)**: depende de que Setup termine — BLOQUEA las 4 historias de usuario
- **User Stories (Phase 3-6)**: todas dependen de que Foundational termine
  - Pueden avanzar en paralelo (si hay más de una persona) o en orden de prioridad (US1 → US2 → US3 → US4)
- **Polish (Phase 7)**: depende de que las historias que se quieran entregar estén completas

### User Story Dependencies

- **US1 (P1)**: puede empezar tras Foundational — sin dependencia de otras historias
- **US2 (P1)**: puede empezar tras Foundational — su hook `useRegisterPayment` (T033) lo reutilizará US3, pero la Historia 2 es independientemente testeable por sí sola
- **US3 (P2)**: puede empezar tras Foundational — su drawer reutiliza `useRegisterPayment` de US2 (T033) y `ExportCsvButton` de US2 (T035), pero el directorio en sí es independientemente testeable sin esas integraciones
- **US4 (P3)**: puede empezar tras Foundational — invalida caché de US1/US2/US3 al emitir, pero la calculadora es independientemente testeable con sus propios hooks

### Within Each User Story

- Tests antes que implementación (deben fallar primero)
- Hooks de `apps/web` antes que páginas
- Página base antes que su integración en `router.tsx`

### Parallel Opportunities

- Todas las tareas [P] de Setup (T001-T007) en paralelo
- Dentro de Foundational: T009 (interfaces) y T010 (factory) no tienen dependencias entre sí y pueden avanzar en paralelo; T011/T012 (tests) en paralelo entre sí; T013/T014/T016 (implementaciones, archivos distintos) en paralelo entre sí una vez sus tests respectivos existen; T020 (primitivas web) y T022 (router) pueden avanzar en paralelo con todo el bloque de `data-supabase` (T008-T019), ya que no comparten archivos
- Tras el checkpoint de Foundational, US1/US2/US3/US4 pueden repartirse entre distintas personas
- Dentro de cada historia, las tareas de test marcadas [P] pueden lanzarse juntas

---

## Parallel Example: Foundational — extracción de `packages/data-supabase`

```bash
# Tests de mapeo fila↔dominio en paralelo:
Task: "Escribir packages/data-supabase/__tests__/SupabaseClientRepository.test.ts"
Task: "Escribir packages/data-supabase/__tests__/SupabaseLoanRepository.test.ts"
Task: "Escribir packages/data-supabase/__tests__/SupabasePortfolioReader.test.ts"

# Implementaciones en paralelo (una vez sus tests existen):
Task: "Mover y refactorizar SupabaseClientRepository.ts a packages/data-supabase"
Task: "Mover, refactorizar y extender SupabaseLoanRepository.ts (+listActive) a packages/data-supabase"
Task: "Implementar SupabasePortfolioReader.ts en packages/data-supabase"
```

---

## Implementation Strategy

### MVP First (User Story 1 + User Story 2 — ambas P1)

Igual que en `specs/001-mobile-field-app/`: sin la Historia 2, el prestamista puede ver su cartera desde la web pero no operar sobre ella (registrar cobros), así que el MVP real de esta fase es Phase 3 + Phase 4 juntas.

1. Completar Phase 1: Setup
2. Completar Phase 2: Foundational (crítico — extrae `@repo/data-supabase` y bloquea todo lo demás)
3. Completar Phase 3: User Story 1 (Dashboard)
4. Completar Phase 4: User Story 2 (Préstamos activos + registrar cobro)
5. **STOP and VALIDATE**: correr `quickstart.md` §US1 y §US2 de punta a punta, incluida la prueba de concurrencia web+móvil
6. Demo/uso real desde escritorio con la misma cartera de prueba de `specs/001-mobile-field-app/`

### Incremental Delivery

1. Setup + Foundational → fundación lista, `apps/mobile` sigue funcionando sin cambios de comportamiento
2. + US1 → probar independientemente → demo (panorama de cartera)
3. + US2 → probar independientemente → demo (MVP funcional completo de esta fase)
4. + US3 → probar independientemente → demo (directorio/CRM)
5. + US4 → probar independientemente → demo (paridad de cotización con móvil)
6. Polish → validación end-to-end, lint, regresión de móvil, actualización de `spec.md` raíz

### Parallel Team Strategy

Con más de una persona: completar Setup + Foundational en conjunto (la extracción de `@repo/data-supabase` es la pieza más riesgosa — conviene no paralelizarla con las historias de usuario); luego repartir US1/US2/US3/US4 (todas independientemente testeables tras el checkpoint de Foundational), coordinando solo en `useRegisterPayment` (T033, compartido entre US2/US3), `ExportCsvButton` (T035, compartido entre US2/US3) y `router.tsx` (un archivo, tocado por cada historia al registrar su ruta — coordinar el orden de merge).

---

## Notes

- `[P]` = archivos distintos, sin dependencias pendientes
- La etiqueta `[Story]` mapea cada tarea a su historia para trazabilidad
- Verificar que los tests fallan antes de implementar (T011, T012, T015, T025, T029, T030, T037, T044)
- Commitear tras cada tarea o grupo lógico
- La Fase 2 modifica código de `specs/001-mobile-field-app/` (`apps/mobile/src/data/`) — su único objetivo es mover código sin cambiar comportamiento; T018 incluye explícitamente verificar que los tests de `apps/mobile` siguen pasando
- Ajuste respecto a `plan.md` §Project Structure: los repositorios de `packages/data-supabase` usan inyección por constructor (reciben un `SupabaseClient` ya creado) en vez de importar un singleton de módulo — necesario para que `apps/mobile` y `apps/web` puedan pasar cada uno sus propias credenciales sin que el paquete lea `process.env`/`import.meta.env` directamente (research.md §6)
