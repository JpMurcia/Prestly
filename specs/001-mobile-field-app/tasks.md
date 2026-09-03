---

description: "Task list template for feature implementation"
---

# Tasks: App Móvil de Cobranza en Campo

**Input**: Design documents from `/specs/001-mobile-field-app/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Se incluyen tareas de test. Para `packages/core` son obligatorias (constitución, principio III, NON-NEGOTIABLE: ningún cambio se acepta sin un test Jest que lo cubra primero). Para `apps/mobile` se incluye un test de integración por historia de usuario, alineado con los escenarios de `quickstart.md`.

**Organization**: Las tareas están agrupadas por historia de usuario para poder implementarlas y probarlas de forma independiente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: A qué historia de usuario pertenece (US1, US2, US3, US4)
- Cada tarea incluye la ruta de archivo exacta

## Path Conventions

Monorepo Turborepo existente — rutas relativas a la raíz del repo, según `plan.md` §Project Structure:

- `apps/mobile/src/` — pantallas, navegación, hooks, capa de datos de la app móvil
- `packages/core/src/` — motor financiero e interfaces (consumido por `apps/mobile` y, a futuro, `apps/web`)
- `packages/ui/src/` — componentes y tokens de diseño compartidos
- `supabase/` — stack local de base de datos (nuevo)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: preparar dependencias y configuración que el resto de fases necesita, sin tocar lógica de producto todavía.

- [X] T001 [P] Añadir dependencias a `apps/mobile/package.json`: `@react-navigation/native`, `@react-navigation/native-stack`, `@react-navigation/bottom-tabs`, `react-native-screens`, `react-native-safe-area-context`, `@tanstack/react-query`, `@react-native-community/netinfo`, `@supabase/supabase-js`, `nativewind`, `tailwindcss` (research.md §1–4, §6); correr `npm install`
- [X] T002 [P] Configurar NativeWind en `apps/mobile` (`babel.config.js`, `metro.config.js`, `tailwind.config.js`, `global.css`, `nativewind-env.d.ts`) per research.md §2
- [X] T003 [P] Configurar Jest + `@testing-library/react-native` (`jest-expo` preset) en `apps/mobile/package.json` con script `"test": "jest"` para que `npm test --workspace=mobile` funcione
- [X] T004 [P] Configurar Jest (`ts-jest` o `babel-jest`) en `packages/core/package.json` con script `"test": "jest"` para que `npm test --workspace=@repo/core` funcione
- [X] T005 [P] Crear estructura de carpetas `apps/mobile/src/{navigation,screens,components,hooks,data,offline}/` y `apps/mobile/__tests__/` con archivos `.gitkeep` o placeholders mínimos
- [X] T006 [P] Crear estructura de carpetas `packages/core/src/{domain,use-cases,interfaces,strategies}/` y `packages/core/__tests__/` (reemplaza el `index.ts` plano actual, que pasa a ser barrel export)
- [X] T007 [P] Crear estructura de carpetas `packages/ui/src/{primitives,tokens}/` (reemplaza el `index.ts` plano actual, que pasa a ser barrel export)
- [X] T008 [P] Crear `.env.example` en la raíz del repo con `SUPABASE_URL`/`SUPABASE_ANON_KEY` (placeholders) y exponerlos a `apps/mobile` vía `app.config.ts` (`expo-constants`), per research.md §6

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: motor financiero real, esquema de base de datos real, capa de datos e infraestructura de UI compartida — nada de esto existe todavía en el repo (ver `plan.md` §Complexity Tracking) y **todas** las historias de usuario dependen de esto.

**⚠️ CRITICAL**: ninguna historia de usuario puede empezar hasta que esta fase esté completa.

### Base de datos

- [X] T009 Ejecutar `npx supabase init` en la raíz del repo para generar `supabase/config.toml` (stack local gestionado por Supabase CLI); confirmar que el puerto de Postgres local queda en `5432` (constitución §Restricciones técnicas)
- [X] T010 Crear `supabase/migrations/0001_initial_schema.sql` con el DDL exacto de `spec.md` raíz §4 (tablas `clientes`/`prestamos`/`cuotas`, enums, índices, `VIEW cliente_score`) — sin modificar ningún campo ni tipo

### Motor financiero (`@repo/core`) — Test-First obligatorio (constitución III)

- [X] T011 [P] Definir `packages/core/src/interfaces/index.ts` con `LoanInput`, `Installment`, `InstallmentSchedule`, `PaymentFrequency`, `IInterestStrategy`, `IClientReader`, `IClientWriter`, `ILoanRepository`, `ClientFilter` — firmas exactas de `contracts/core-interfaces.md`
- [X] T012 [P] Escribir `packages/core/__tests__/amortization-calculator.test.ts` con el caso de referencia de `spec.md` raíz §5.1 (capital $500, tasa 15%, 12 cuotas semanales → cuota $47.92, interés total $75.00, total $575.00, capital/cuota $41.67, interés/cuota $6.25) — este test DEBE existir y fallar antes de T013/T014 (depende de T011)
- [X] T013 Implementar `packages/core/src/strategies/FlatRateFixedInstallmentStrategy.ts` (`IInterestStrategy`) per `spec.md` raíz §5.1, incluyendo la regla de redondeo/conciliación de §5.3 (la última cuota absorbe el residuo) — depende de T011
- [X] T014 Implementar `packages/core/src/domain/AmortizationCalculator.ts` que consume `IInterestStrategy`, per `contracts/core-interfaces.md` — hace pasar el test de T012; depende de T011, T013
- [X] T015 [P] Actualizar `packages/core/src/index.ts` para exportar `AmortizationCalculator`, `FlatRateFixedInstallmentStrategy` y todas las interfaces/tipos como contrato público del paquete — depende de T013, T014

### Capa de datos (`apps/mobile/src/data`) — implementación concreta de las interfaces

- [X] T016 [P] Crear `apps/mobile/src/data/supabaseClient.ts` inicializando el cliente `@supabase/supabase-js` desde la configuración de entorno (T008) — el ÚNICO archivo de `apps/mobile` que puede importar `@supabase/supabase-js` directamente (regla DIP de `contracts/core-interfaces.md`)
- [X] T017 Implementar `apps/mobile/src/data/SupabaseClientRepository.ts` (`IClientReader` + `IClientWriter`) contra `clientes` + `VIEW cliente_score`, per `contracts/data-contract.md` §US3/§US4 — depende de T010, T011, T016
- [X] T018 Implementar `apps/mobile/src/data/SupabaseLoanRepository.ts` (`ILoanRepository`, incluyendo la emisión atómica con cuotas y el `update` de cobro con guarda de concurrencia), per `contracts/data-contract.md` §US1/§US2 — depende de T010, T011, T016
- [X] T019 [P] Crear `apps/mobile/src/offline/useNetworkStatus.ts` envolviendo `@react-native-community/netinfo`, per research.md §4 (soporte de FR-013)

### Sistema de diseño y navegación compartidos

- [X] T020 [P] Crear `packages/ui/src/tokens/colors.ts` y `packages/ui/src/tokens/typography.ts` con la paleta (`#10B981`/`#1E3A8A`/`#0F172A`) y tipografías (Plus Jakarta Sans + Inter) de `spec.md` raíz §9
- [X] T021 [P] Implementar primitivas en `packages/ui/src/primitives/` (`Button.tsx`, `Card.tsx`, `Badge.tsx`, `ProgressBar.tsx`, `Chip.tsx`, `Avatar.tsx`) con className NativeWind, per research.md §2 — depende de T020
- [X] T022 [P] Actualizar `packages/ui/src/index.ts` para exportar tokens y primitivas como contrato público del paquete — depende de T020, T021
- [X] T023 Crear `apps/mobile/src/navigation/RootNavigator.tsx` (bottom-tabs: Ruta de hoy / Directorio / Calculadora, con native-stack para pantallas de detalle) per research.md §1 y `plan.md` §Project Structure — depende de T005
- [X] T024 Actualizar `apps/mobile/App.tsx` para renderizar `QueryClientProvider` (TanStack Query) envolviendo `RootNavigator`, reemplazando el placeholder actual — depende de T023

**Checkpoint**: fundación lista — el motor financiero calcula el caso de referencia correctamente, la base de datos local existe con el esquema completo, la capa de datos implementa las tres interfaces, y hay navegación + sistema de diseño para montar pantallas. Las historias de usuario pueden empezar (en paralelo si hay más de una persona).

---

## Phase 3: User Story 1 - Cotizar y emitir un préstamo frente al cliente (Priority: P1) 🎯 MVP

**Goal**: el prestamista ajusta monto/tasa/plazo/frecuencia con recálculo instantáneo, ve la tabla completa, puede compartirla, y emite el préstamo ahí mismo.

**Independent Test**: ajustar los parámetros de una simulación, verificar que el total/cuota/tabla se recalculan al instante, y confirmar "Emitir este préstamo" para un cliente nuevo o existente — entrega valor por sí sola.

### Tests for User Story 1

- [X] T025 [P] [US1] Escribir `apps/mobile/__tests__/QuoteCalculatorScreen.test.tsx` cubriendo los escenarios de aceptación 1 y 2 de spec.md (recálculo instantáneo; tabla completa cuyos totales coinciden con el resumen) — debe fallar antes de T029
- [X] T026 [P] [US1] Escribir `packages/core/__tests__/use-cases/issue-loan.test.ts` cubriendo la emisión con cliente nuevo y con cliente existente (Historia 2 de `spec.md` raíz) — debe fallar antes de T028

### Implementation for User Story 1

- [X] T027 [US1] Implementar `packages/core/src/use-cases/quoteLoan.ts` (función pura que envuelve `AmortizationCalculator` para la capa de app) — depende de T014
- [X] T028 [US1] Implementar `packages/core/src/use-cases/issueLoan.ts` orquestando `IClientReader`/`IClientWriter`/`ILoanRepository` per `contracts/data-contract.md` §US1 (buscar-o-crear cliente, luego guardar préstamo+cuotas de forma atómica) — hace pasar T026; depende de T011, T017, T018
- [X] T029 [US1] Construir `apps/mobile/src/screens/QuoteCalculatorScreen.tsx`: controles de monto/tasa/plazo/frecuencia, tarjeta de totales, alternancia "primeras cuotas"/"tabla completa" per mockups 1a/2a — hace pasar T025; depende de T027, T021
- [X] T030 [US1] Implementar `apps/mobile/src/hooks/useIssueLoan.ts` (mutación TanStack Query envolviendo `issueLoan`, invalidando caché de directorio/ruta de cobranza per FR-009) — depende de T028
- [X] T031 [US1] Añadir acción "Compartir tabla" en `QuoteCalculatorScreen` usando el módulo `Share` nativo de React Native (FR-003) — depende de T029
- [X] T032 [US1] Añadir flujo "Emitir este préstamo" en `QuoteCalculatorScreen`: buscar/seleccionar cliente existente o capturar nombre+teléfono de uno nuevo, con guarda anti-duplicado por teléfono (data-model.md) — depende de T029, T030
- [X] T033 [US1] Bloquear "Emitir este préstamo" según `useNetworkStatus` (T019), mostrando el aviso de FR-013 sin conexión — depende de T019, T032
- [X] T034 [US1] Registrar `QuoteCalculatorScreen` como raíz de tab en `RootNavigator` — depende de T023, T029

**Checkpoint**: User Story 1 funciona de forma completa e independiente.

---

## Phase 4: User Story 2 - Cobrar una cuota en la ruta de cobranza diaria (Priority: P1) 🎯 MVP

**Goal**: el prestamista abre la ruta del día ordenada por prioridad y registra cada cobro con el cambio calculado automáticamente.

**Independent Test**: con un préstamo que tenga cuotas pendientes, abrir la ruta del día, tocar un cliente, ingresar el monto recibido y confirmar el cobro — el saldo y el resumen del día se actualizan solos.

### Tests for User Story 2

- [X] T035 [P] [US2] Escribir `apps/mobile/__tests__/CollectionRouteScreen.test.tsx` cubriendo los escenarios de aceptación 1, 3, 4 y 5 de spec.md (orden por prioridad, cálculo de cambio, actualización inmediata, estado vacío) — debe fallar antes de T039
- [X] T036 [P] [US2] Escribir `packages/core/__tests__/use-cases/register-payment.test.ts` cubriendo el cálculo de cambio y el rechazo de montos recibidos menores al de la cuota (FR-014) — debe fallar antes de T037

### Implementation for User Story 2

- [X] T037 [US2] Implementar `packages/core/src/use-cases/registerPayment.ts` (cambio a entregar = recibido − monto_cuota; sin pagos parciales, FR-014) — hace pasar T036; depende de T011
- [X] T038 [US2] Implementar `apps/mobile/src/hooks/useCollectionRoute.ts` (TanStack Query, consulta de ruta de cobranza de `data-model.md`/`data-contract.md`, vencidas primero) — depende de T018
- [X] T039 [US2] Construir `apps/mobile/src/screens/CollectionRouteScreen.tsx`: resumen del día, lista de fila de 64px (mockup 2d), estado vacío positivo — hace pasar T035; depende de T038, T021
- [X] T040 [US2] Implementar `apps/mobile/src/hooks/useRegisterPayment.ts` (mutación TanStack Query envolviendo `registerPayment` + el `update` guardado de `SupabaseLoanRepository`; invalida ruta de cobranza, directorio y perfil per FR-009) — depende de T018, T037
- [X] T041 [US2] Construir el modal "Registrar cobro" en `apps/mobile/src/components/RegisterPaymentModal.tsx` per mockup 1b: monto de la cuota, monto recibido, método de pago, cambio a entregar — depende de T040
- [X] T042 [US2] Bloquear "Confirmar cobro" según `useNetworkStatus` (T019) per FR-013, con la guarda anti-duplicado de `contracts/data-contract.md` — depende de T019, T041
- [X] T043 [US2] Registrar `CollectionRouteScreen` como raíz de tab en `RootNavigator` — depende de T023, T039

**Checkpoint**: User Story 1 y 2 (el MVP completo) funcionan de forma independiente.

---

## Phase 5: User Story 3 - Consultar el directorio y la cartera de clientes (Priority: P2)

**Goal**: el prestamista busca y filtra su cartera completa por nombre, teléfono o estado.

**Independent Test**: con varios clientes en distintos estados, buscar por nombre/teléfono parcial y aplicar cada filtro de estado, confirmando que lista y conteo coinciden.

### Tests for User Story 3

- [X] T044 [P] [US3] Escribir `apps/mobile/__tests__/ClientDirectoryScreen.test.tsx` cubriendo los escenarios de aceptación 1, 2 y 5 de spec.md (búsqueda, filtros con conteo, estado vacío) — debe fallar antes de T046

### Implementation for User Story 3

- [X] T045 [US3] Implementar `apps/mobile/src/hooks/useClientDirectory.ts` (TanStack Query envolviendo `IClientReader.list(filter)` per `contracts/data-contract.md` §US3) — depende de T017
- [X] T046 [US3] Construir `apps/mobile/src/screens/ClientDirectoryScreen.tsx`: buscador, chips de filtro con conteo, tarjetas de cliente (estado/saldo/progreso) per mockup 2b — hace pasar T044; depende de T045, T021
- [X] T047 [US3] Añadir estado vacío ("sin resultados") y acciones rápidas por tarjeta (WhatsApp / "Cobrar $X" → abre `RegisterPaymentModal` de T041) en `ClientDirectoryScreen`
- [X] T048 [US3] Registrar `ClientDirectoryScreen` como raíz de tab en `RootNavigator` — depende de T023, T046

**Checkpoint**: User Story 1, 2 y 3 funcionan de forma independiente.

---

## Phase 6: User Story 4 - Evaluar el perfil 360° de un cliente antes de prestarle de nuevo (Priority: P3)

**Goal**: el prestamista revisa score de confianza, historial de puntualidad, préstamos anteriores y notas privadas de un cliente.

**Independent Test**: con un cliente que tenga al menos un préstamo liquidado y uno activo, abrir su perfil y verificar score/historial/lista de préstamos, y que una nota privada se guarde y persista.

### Tests for User Story 4

- [X] T049 [P] [US4] Escribir `apps/mobile/__tests__/ClientProfileScreen.test.tsx` cubriendo los escenarios de aceptación 1, 2, 3 y 4 de spec.md (score+fracción, "sin historial", historial de préstamos, notas persistidas) — debe fallar antes de T051

### Implementation for User Story 4

- [X] T050 [US4] Implementar `apps/mobile/src/hooks/useClientProfile.ts` (TanStack Query combinando `IClientReader.findById` + `ILoanRepository.listByClient` + lectura de `cliente_score` per `contracts/data-contract.md` §US4) — depende de T017, T018
- [X] T051 [US4] Construir `apps/mobile/src/screens/ClientProfileScreen.tsx`: badge de score + fracción, franja de historial de puntualidad, historial de préstamos per mockup 2c — hace pasar T049; depende de T050, T021
- [X] T052 [US4] Implementar `apps/mobile/src/hooks/useUpdateClientNotes.ts` (mutación TanStack Query envolviendo `IClientWriter.update`) + editor de notas en `ClientProfileScreen` (FR-012) — depende de T017
- [X] T053 [US4] Registrar `ClientProfileScreen` en `RootNavigator`, alcanzable desde tarjetas del Directorio (T046) y de la Ruta de cobranza (T039) — depende de T023, T046, T039, T051

**Checkpoint**: las 4 historias de usuario funcionan de forma independiente.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: mejoras que afectan a varias historias y cierre de la feature.

- [X] T054 [P] Construir `apps/mobile/src/screens/LoanDetailScreen.tsx` (mockup 1b: tarjeta de cliente, progreso, cronograma) reutilizando `RegisterPaymentModal` (T041), alcanzable desde Directorio y Perfil
- [X] T055 [P] Ejecutar `npx supabase db reset` y recorrer manualmente `quickstart.md` de punta a punta (las 4 historias)
- [X] T056 [P] Pasada de lint (`turbo run lint`) consistente en `apps/mobile`, `packages/core`, `packages/ui`
- [X] T057 Revisión visual contra las convenciones de la intro del Turno 2 de los mockups (cifras `tabular-nums`, sistema de color de estado) en `apps/mobile/src/screens/QuoteCalculatorScreen.tsx`, `CollectionRouteScreen.tsx`, `ClientDirectoryScreen.tsx` y `ClientProfileScreen.tsx`
- [X] T058 Actualizar el Anexo de `spec.md` (raíz del repo, no `specs/001-mobile-field-app/spec.md`) marcando "App Móvil" (Fase 2 del negocio) como entregada, una vez T055 pase sin hallazgos

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
- **US2 (P1)**: puede empezar tras Foundational — usa el mismo `RegisterPaymentModal` que reutilizará US3/Polish, pero es independientemente testeable por sí sola
- **US3 (P2)**: puede empezar tras Foundational — su acción rápida "Cobrar $X" enlaza al modal de US2, pero la pantalla de directorio es independientemente testeable sin esa integración
- **US4 (P3)**: puede empezar tras Foundational — su navegación de entrada normalmente viene de US3/US2, pero la pantalla de perfil es independientemente testeable con un `clientId` fijo

### Within Each User Story

- Tests antes que implementación (deben fallar primero)
- Casos de uso de `packages/core` antes que hooks de `apps/mobile`
- Hooks antes que pantallas
- Pantalla base antes que su integración en `RootNavigator`

### Parallel Opportunities

- Todas las tareas [P] de Setup (T001-T008) en paralelo
- Dentro de Foundational: T011 bloquea a T012/T013/T014, pero T016, T019, T020 pueden avanzar en paralelo con la rama del motor financiero (T011-T015)
- Tras el checkpoint de Foundational, US1/US2/US3/US4 pueden repartirse entre distintas personas
- Dentro de cada historia, las tareas de test marcadas [P] pueden lanzarse juntas

---

## Parallel Example: User Story 1

```bash
# Tests de la Historia 1 en paralelo:
Task: "Escribir apps/mobile/__tests__/QuoteCalculatorScreen.test.tsx"
Task: "Escribir packages/core/__tests__/use-cases/issue-loan.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 + User Story 2 — ambas P1)

`spec.md` marca **dos** historias como P1 (cotizar+emitir, y cobrar en ruta): sin la segunda, el prestamista puede prometer un préstamo pero no cobrar ninguna cuota, así que el MVP real es la fase 3 + fase 4 juntas, no solo la fase 3.

1. Completar Phase 1: Setup
2. Completar Phase 2: Foundational (crítico — bloquea todo lo demás)
3. Completar Phase 3: User Story 1
4. Completar Phase 4: User Story 2
5. **STOP and VALIDATE**: correr `quickstart.md` §US1 y §US2 de punta a punta
6. Demo/uso real en campo con una cartera pequeña de prueba

### Incremental Delivery

1. Setup + Foundational → fundación lista
2. + US1 → probar independientemente → demo (cotizar/emitir)
3. + US2 → probar independientemente → demo (MVP funcional completo)
4. + US3 → probar independientemente → demo (directorio/cartera)
5. + US4 → probar independientemente → demo (perfil 360°/notas)
6. Polish → `LoanDetailScreen`, validación end-to-end, lint, actualización de `spec.md` raíz

### Parallel Team Strategy

Con más de una persona: completar Setup + Foundational en conjunto; luego repartir US1/US2/US3/US4 (todas independientemente testeables tras el checkpoint de Foundational), coordinando solo en `RegisterPaymentModal` (compartido entre US2/US3/Polish) y `RootNavigator` (un archivo, tocado por cada historia al registrarse — evitar conflictos coordinando el orden de merge).

---

## Notes

- `[P]` = archivos distintos, sin dependencias pendientes
- La etiqueta `[Story]` mapea cada tarea a su historia para trazabilidad
- Verificar que los tests fallan antes de implementar (T012, T025, T026, T035, T036, T044, T049)
- Commitear tras cada tarea o grupo lógico
- Ajuste respecto a `plan.md` §Project Structure: no se crea un `supabase/docker-compose.yml` manual — el stack local lo gestiona el propio Supabase CLI (`supabase/config.toml`, T009); lo que sí se versiona es `supabase/migrations/` (T010)
