---

description: "Task list template for feature implementation"
---

# Tasks: Gestión Operativa Integral — Pagos Parciales, Liquidación Anticipada y Tendencia de Cartera

**Input**: Design documents from `/specs/003-operational-management/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Se incluyen tareas de test para `packages/data-supabase` (Test-First — código que mueve dinero, mismo criterio que fases anteriores) y un test de integración por historia de usuario en `apps/web`. `packages/core` no gana lógica de cálculo nueva (solo tipos/firmas), así que no requiere un test Jest nuevo bajo la constitución, Principio III — mismo razonamiento ya usado en `specs/002-admin-web/tasks.md`.

**Organization**: Las tareas están agrupadas por historia de usuario para poder implementarlas y probarlas de forma independiente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: A qué historia de usuario pertenece (US1, US2, US3)
- Cada tarea incluye la ruta de archivo exacta

## Path Conventions

Monorepo Turborepo existente — rutas relativas a la raíz del repo, según `plan.md` §Project Structure. Ningún paquete ni carpeta nueva; esta fase extiende archivos ya existentes de `specs/001-mobile-field-app/` y `specs/002-admin-web/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: preparar la única dependencia nueva antes de tocar código de producto.

- [X] T001 [P] Añadir `recharts` a `apps/web/package.json` (dependencia, para el panel de tendencia de US3); correr `npm install` — **hecho**, `recharts@^3.10.1` (verificado contra npm, no la versión estimada inicialmente)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: extender el esquema de base de datos, las interfaces de `@repo/core` y la capa de datos compartida (`packages/data-supabase`) — nada de esto existe todavía y **todas** las historias de usuario dependen de esto. Incluye corregir dos lugares del código ya existente que rompen en cuanto existe el estado `'parcial'` (no es alcance nuevo, es una consecuencia necesaria — ver `data-model.md`).

**⚠️ CRITICAL**: ninguna historia de usuario puede empezar hasta que esta fase esté completa.

### Base de datos

- [X] T002 Crear `supabase/migrations/0004_pagos_parciales.sql` con el contenido exacto de `data-model.md` — **hecho y validado contra Postgres real** (`npx supabase db reset` + script ad-hoc ejercitando `registrar_cobro`/`liquidar_prestamo`/`cartera_resumen`/`cartera_tendencia_mensual` de punta a punta). Dos ajustes descubiertos que `data-model.md` no anticipaba, corregidos en la migración y documentados ahí: (a) `cliente_score` **y** `cartera_resumen` dependen de `cuotas.estado` y bloquean el `ALTER COLUMN ... TYPE` si no se sueltan primero (`DROP VIEW` de ambas antes del ALTER, recreadas después — `cliente_score` idéntica, `cartera_resumen` corregida); (b) el índice parcial `idx_cuotas_pendientes` (`WHERE estado = 'pendiente'`) también bloquea el ALTER por el mismo motivo — recreado después cubriendo `('pendiente', 'parcial')`, lo que además corrige que `listCollectionRoute` (T007) hoy excluiría cuotas parciales de la ruta de cobranza si no se actualiza su filtro

### `@repo/core` — extensión de interfaces (sin nueva lógica de cálculo)

- [X] T003 [P] Extender `packages/core/src/interfaces/index.ts`: `InstallmentStatus` gana `'partial'`; en `ILoanRepository`, reemplazar `markInstallmentPaid(installmentId)` por `registerInstallmentPayment(installmentId, amount)` y añadir `payoffLoan(loanId)`; añadir `PortfolioTrendPoint` y el método `getTrend()` en `IPortfolioReader` — firmas exactas de `contracts/core-interfaces.md` — **hecho**. **Hallazgo no anticipado por el plan**: `packages/core/src/use-cases/registerPayment.ts` (consumido por `apps/mobile`) SÍ tenía lógica de cálculo real que enforzaba FR-014 (rechazar pagos parciales) — no era "solo tipos" como asumía `plan.md`. Reescrito para devolver `{ amountApplied, changeDue }` en vez de lanzar `PartialPaymentNotAllowedError` (eliminada); su test (`packages/core/__tests__/use-cases/register-payment.test.ts`) actualizado — Test-First sí aplicó aquí, a diferencia de lo planeado

### `packages/data-supabase` — Test-First para el mapeo fila↔dominio y los procedimientos nuevos

- [X] T004 [P] Extender `packages/data-supabase/__tests__/SupabaseLoanRepository.test.ts` (mock de `SupabaseClient`) cubriendo: `registerInstallmentPayment` con pago total (`amount` == saldo restante, RPC `registrar_cobro` sin `p_monto` o con el saldo exacto) y con pago parcial (`p_monto` explícito, la cuota resultante mapea `estado: 'parcial'` → `status: 'partial'`); `payoffLoan` (RPC `liquidar_prestamo`, releer el préstamo tras la llamada); el error `P0002` (`MONTO_INVALIDO`) mapeando a una nueva `InvalidPaymentAmountError`; el error de `liquidar_prestamo` sobre un préstamo no activo mapeando a una nueva `LoanNotActiveError` — debe fallar antes de T007
- [X] T005 [P] Extender `packages/data-supabase/__tests__/SupabasePortfolioReader.test.ts` cubriendo `getTrend()` (mapeo de filas de `cartera_tendencia_mensual` a `PortfolioTrendPoint[]`) — debe fallar antes de T008
- [X] T006 [P] Extender `packages/data-supabase/__tests__/SupabaseClientRepository.test.ts` con un caso donde una cuota tiene `estado: 'parcial'` y `monto_pagado` mayor a 0 — el saldo (`balance`) del portafolio del cliente debe descontar ese monto ya cobrado (hoy solo lo descuenta si `estado === 'pagado'`, ver `data-model.md`) — debe fallar antes de T009

### `packages/data-supabase` — implementación

- [X] T007 Implementar `registerInstallmentPayment`/`payoffLoan` en `packages/data-supabase/src/SupabaseLoanRepository.ts` (reemplaza `markInstallmentPaid`); añadir `InvalidPaymentAmountError` y `LoanNotActiveError`; extender `INSTALLMENT_STATUS_FROM_DB` con `'parcial': 'partial'` — **hecho**; también corregido `listCollectionRoute` (`.eq('estado','pendiente')` → `.in('estado', ['pendiente','parcial'])`), hallazgo del propio T002 (índice parcial recreado para ambos estados)
- [X] T008 Implementar `getTrend()` en `packages/data-supabase/src/SupabasePortfolioReader.ts` (`select * from cartera_tendencia_mensual order by periodo`) — hecho
- [X] T009 Corregir `computePortfolio` en `packages/data-supabase/src/SupabaseClientRepository.ts` (crédito lo realmente cobrado sin importar el estado) — hecho; también corregidos `proxima`/`nextInstallmentAmount` (mismo archivo) para tratar `'parcial'` como pendiente y mostrar el saldo restante, no el monto original — mismo hallazgo que T007
- [X] T010 Actualizar `packages/data-supabase/src/index.ts` exportando `InvalidPaymentAmountError`, `LoanNotActiveError` — hecho

### Corrección del mismo bug fuera de `packages/data-supabase`

- [X] T011 [P] Corregir `deriveLoanStatus` en `apps/web/src/lib/loanStatus.ts`: mismo ajuste que T009 (`i.status === 'paid' ? (i.paidAmount ?? i.totalAmount) : 0` → `i.paidAmount ?? 0`, salvo cuando `status === 'paid'` sin `paidAmount`, que sigue usando `totalAmount`) — depende de T003

**Checkpoint**: fundación lista — `registrar_cobro`/`liquidar_prestamo` existen y son correctos bajo concurrencia; `@repo/core` expone las interfaces nuevas; `packages/data-supabase` las implementa y ya no subestima saldos/dashboard con cuotas parciales. Las historias de usuario pueden empezar.

---

## Phase 3: User Story 1 - Registrar un pago parcial de una cuota (Priority: P1)

**Goal**: el prestamista registra, desde móvil o web, un cobro por cualquier monto hasta el saldo restante de una cuota — menor la deja "parcial", igual al saldo la deja "pagada".

**Independent Test**: con una cuota pendiente de $47.92, registrar un cobro de $20.00 y verificar que queda "parcial" con $27.92 de saldo restante; registrar un segundo cobro por el resto y verificar que pasa a "pagada" con el acumulado exacto.

### Tests for User Story 1

- [X] T012 [P] [US1] Extender `apps/web/__tests__/LoanAmortizationPage.test.tsx` — **hecho**: pago total (input precargado con el saldo, un clic), pago parcial (editar el monto a $20, verifica `registerInstallmentPayment('cu2', 20)`). El rechazo de sobrepago (escenario 3) es una guarda de base de datos ya cubierta a nivel `packages/data-supabase` (T004) — el `max` del input HTML es una ayuda de UX, no la validación real

### Implementation for User Story 1

- [X] T013 [US1] Actualizar `apps/web/src/hooks/useRegisterPayment.ts`: firma `{installmentId, amount}`, invalida préstamo/préstamos-activos/dashboard/directorio/tendencia — hecho
- [X] T014 [US1] Actualizar `apps/web/src/pages/LoanAmortizationPage.tsx`: input numérico por fila precargado con el saldo restante (research.md §7), badge "Parcial" distinto de "Pendiente"/"Pagado" — hecho. **Se construyó junto con T020 (US2)** en el mismo archivo — ver nota ahí
- [X] T015 [US1] Actualizar `apps/web/src/components/ClientDetailDrawer.tsx`: botón "Registrar cobro $X" ahora usa el saldo restante real (no `totalAmount`) y pasa `{installmentId, amount}`; mini-tabla de amortización muestra "Parcial" — hecho
- [X] T016 [US1] Actualizar el modal "Registrar cobro" en `apps/mobile` — **el componente real es `apps/mobile/src/components/RegisterPaymentModal.tsx`** (no una pantalla, tasks.md original lo describía mal), compartido por `ClientDirectoryScreen`, `CollectionRouteScreen` y `LoanDetailScreen`. Ya tenía el campo "Recibido" editable (mockup 1b) pero **bloqueaba activamente el envío** si el monto era menor al de la cuota (`disabled={isPartial || ...}`, aviso rojo "no se admiten pagos parciales") — enforzaba FR-014 de specs/001. Reescrito: usa `registerPayment` de `@repo/core` (ya corregido en T003) para calcular `amountApplied`/`changeDue`, ya no bloquea el envío, aviso reescrito como informativo ("se registrará como parcial, faltan $X"); prop renombrada `installmentAmount` → `remainingBalance` (los 3 llamadores ahora pasan el saldo restante real, no el monto original, reutilizando los valores ya corregidos en T009). `LoanDetailScreen.tsx` (no listado en el plan original) también corregido: cálculo de saldo, badge "Parcial" en el cronograma
- [X] T017 [US1] Verificar y extender los tests de `apps/mobile` — **hecho**: `npm test --workspace=mobile` pasa (10/10, sin regresión) tras el reemplazo de `markInstallmentPaid`; se añadió un test nuevo en `CollectionRouteScreen.test.tsx` que ejercita el flujo completo de un pago parcial (cuota `'partial'` con $20 ya abonados → resumen del día muestra el saldo restante $27.92, no $47.92; registrar $10 adicionales llama a `registerInstallmentPayment('installment-1', 10)`)

**Checkpoint**: User Story 1 funciona de forma completa e independiente en ambas apps.

---

## Phase 4: User Story 2 - Liquidar anticipadamente un préstamo completo (Priority: P1)

**Goal**: el prestamista liquida un préstamo activo en una sola operación, viendo antes el monto exacto a cobrar.

**Independent Test**: con un préstamo activo con cuotas pendientes/parciales, liquidarlo anticipadamente y verificar que todas sus cuotas quedan "pagadas", el préstamo queda "liquidado" y desaparece de "Préstamos activos".

### Tests for User Story 2

- [X] T018 [P] [US2] Extender `apps/web/__tests__/LoanAmortizationPage.test.tsx` — **hecho**: verifica que el botón muestra el saldo restante correcto ("Liquidar anticipadamente ($47.92)"), que `window.confirm` se llama con ese monto, y que confirmar llama a `payoffLoan('p1')`. El rechazo de una segunda liquidación (guarda `P0003`) queda cubierto a nivel `packages/data-supabase` (T004), no se duplicó aquí

### Implementation for User Story 2

- [X] T019 [US2] Implementar `apps/web/src/hooks/usePayoffLoan.ts` — hecho
- [X] T020 [US2] Añadir la acción "Liquidar anticipadamente" en `apps/web/src/pages/LoanAmortizationPage.tsx` — **hecho, construido junto con T014** en la misma pasada (mismo archivo, mismo commit lógico): botón en el encabezado con el saldo restante del préstamo ya calculado del `Loan` cargado, `window.confirm` antes de llamar a `payoffLoan`
- [X] T021 [US2] Añadir la misma acción en `apps/mobile` — **hecho en `apps/mobile/src/screens/LoanDetailScreen.tsx`** (tasks.md original no nombraba el archivo correcto — es la única pantalla de detalle de préstamo de la app móvil, construida junto con el fix de US1 ahí mismo): botón "Liquidar anticipadamente" con `Alert.alert` de confirmación mostrando el saldo restante
- [X] T022 [US2] Verificar los tests de `apps/mobile` tras T021 — `npm test --workspace=mobile` pasa (10/10, sin test dedicado nuevo para liquidación anticipada — el botón no tenía cobertura de test previa en `LoanDetailScreen`, igual que antes de esta fase; T017 sí cubre el flujo de pago parcial con test nuevo)

**Checkpoint**: User Story 1 y 2 (el MVP completo de esta fase) funcionan de forma independiente.

---

## Phase 5: User Story 3 - Ver la tendencia de ganancias y capital de la cartera (Priority: P2)

**Goal**: el prestamista ve, en la web, cómo evolucionó su cartera mes a mes.

**Independent Test**: con actividad repartida en varios meses, abrir el panel de tendencia y verificar que la serie coincide con la suma real agrupada por mes; con menos de un mes de historial, ver el estado de "historial limitado".

### Tests for User Story 3

- [X] T023 [P] [US3] Extender `apps/web/__tests__/DashboardPage.test.tsx` — **hecho**: 2 tests nuevos (gráfica visible con ≥2 meses de datos; estado "historial limitado" con 1 mes, sin gráfica), más `getTrend` mockeado en los 2 tests ya existentes de las 4 métricas

### Implementation for User Story 3

- [X] T024 [US3] Implementar `apps/web/src/hooks/usePortfolioTrend.ts` — hecho
- [X] T025 [US3] Construir el panel de tendencia en `apps/web/src/pages/DashboardPage.tsx` con `recharts` (`LineChart`, 3 líneas) — hecho. Un ajuste de tipos sobre el diseño original: el `formatter` de `Tooltip` de recharts espera `ValueType | undefined`, no `number` — resuelto con `Number(value)` en vez de tipar el parámetro como `number`

**Checkpoint**: las 3 historias de usuario funcionan de forma independiente.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: validación end-to-end contra Postgres real (incluida concurrencia), regresión de fases anteriores, y cierre de la feature.

- [X] T026 [P] Ejecutar `npx supabase db reset` y recorrer `quickstart.md` de punta a punta — **hecho contra Postgres real y `apps/web` corriendo en el navegador**. US1: pago parcial ($20 sobre $47.92) deja la cuota "Parcial" con saldo correcto, un segundo abono la completa a "Pagada", dashboard refleja cada cambio (`total_recuperado`/`intereses_ganados` correctos incluso a mitad de pagar una cuota). US2: "Liquidar anticipadamente" muestra el monto exacto, confirma, las 12 cuotas quedan pagadas y el préstamo desaparece de "Préstamos activos" — validado también con `window.confirm` real (no solo mockeado en tests). US3: panel de tendencia muestra "historial limitado" correctamente con los datos reales de esta sesión (toda la actividad cae en un solo mes). SC-004 (concurrencia liquidación vs. cobro individual) validado con un script ad-hoc contra el RPC real: `liquidar_prestamo` y `registrar_cobro` disparados a la vez sobre cuotas del mismo préstamo → 12/12 cuotas pagadas, $575.00 exactos, 0 duplicados. **2 bugs reales encontrados y corregidos durante esta verificación** (ninguno detectable por los tests con mocks): (1) el `<input>` de monto en `LoanAmortizationPage.tsx` no se limpiaba tras un pago exitoso, reenviando el monto viejo en vez del nuevo saldo restante en un segundo abono — corregido limpiando ese campo en el `onSuccess` de la mutación, con test de regresión nuevo; (2) `totalAmount - paidAmount` sin redondear producía basura de punto flotante (`7.920000000000002`) en 4 lugares (`LoanAmortizationPage.tsx`, `SupabaseClientRepository.ts`, 2 pantallas de `apps/mobile`) que alimentaba directamente `<input>`s y el modal de cobro — corregido redondeando a 2 decimales en cada punto de cómputo, más una capa defensiva dentro de `RegisterPaymentModal.tsx`
- [X] T027 [P] Pasada de lint (`turbo run lint`) en `apps/web`, `apps/mobile`, `packages/data-supabase`, `packages/core` — **0 warnings, 0 errors** en los 4; el único warning del monorepo (`ClientProfileScreen.tsx`, `set-state-in-effect`) es preexistente, no relacionado con esta fase. `npm run type-check` y `npm run test` también limpios en las 5 packages — vuelto a verificar tras los 2 fixes de T026 (58 tests: 13 `@repo/core` + 19 `@repo/data-supabase` + 15 `web` + 11 `mobile`; +1 sobre el conteo original, el test de regresión del reset del input — el fix de redondeo no sumó un test dedicado, se verificó manualmente en el navegador)
- [X] T028 Verificar que las historias de `specs/002-admin-web/` siguen funcionando — **hecho**: dashboard, préstamos activos (vacío tras liquidar), directorio de clientes y su drawer (score "sin historial", mini-amortización con las 12 cuotas "Pagado") probados en el navegador tras completar US1/US2/US3 de esta fase. Único comportamiento distinto observado: un cliente cuyo único préstamo ya se liquidó (por esta fase o por plazo normal) muestra "Prestado $0.00"/"Sin préstamo activo" en el resumen superior del drawer — **no es una regresión**, es el diseño ya documentado de `ClientPortfolioSummary` de `specs/002-admin-web/` (`portfolio` refleja solo el préstamo *activo*, nunca cambió); la mini-tabla de amortización de abajo sí sigue mostrando el historial completo vía `listByClient`, sin cambios
- [X] T029 Actualizar el Anexo de `spec.md` (raíz del repo) marcando "Gestión Operativa Integral" (Fase 4 del negocio) como entregada, una vez T026 pase sin hallazgos — T026 pasó (con 2 bugs encontrados Y corregidos en el momento, no hallazgos pendientes)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias — puede arrancar de inmediato
- **Foundational (Phase 2)**: depende de que Setup termine — BLOQUEA las 3 historias de usuario
- **User Stories (Phase 3-5)**: todas dependen de que Foundational termine
  - Pueden avanzar en paralelo (si hay más de una persona) o en orden de prioridad (US1 → US2 → US3)
- **Polish (Phase 6)**: depende de que las historias que se quieran entregar estén completas

### User Story Dependencies

- **US1 (P1)**: puede empezar tras Foundational — sin dependencia de otras historias
- **US2 (P1)**: puede empezar tras Foundational — independientemente testeable de US1, aunque comparte el mismo botón "Registrar"/contexto de página en `LoanAmortizationPage.tsx` (coordinar el orden de merge si se paraleliza)
- **US3 (P2)**: puede empezar tras Foundational — sin dependencia de US1/US2 (lee `cartera_tendencia_mensual`, que ya existe desde Foundational)

### Within Each User Story

- Tests antes que implementación (deben fallar primero)
- Hooks antes que páginas/pantallas
- `apps/web` y `apps/mobile` de una misma historia pueden avanzar en paralelo (archivos distintos)

### Parallel Opportunities

- T001 (Setup) en paralelo con el inicio de Foundational (no depende de nada de Phase 2)
- Dentro de Foundational: T003 sin dependencias; T004/T005/T006 (tests) en paralelo entre sí una vez T003 existe; T007/T008/T009 (implementaciones) en paralelo entre sí una vez sus tests respectivos existen (archivos distintos); T011 en paralelo con todo el bloque de `packages/data-supabase`
- Tras el checkpoint de Foundational, US1/US2/US3 pueden repartirse entre distintas personas
- Dentro de cada historia, `apps/web` (T014/T015 o T020) y `apps/mobile` (T016 o T021) del mismo bloque son archivos distintos y pueden avanzar en paralelo

---

## Parallel Example: Foundational

```bash
# Tests de packages/data-supabase en paralelo (una vez T003 existe):
Task: "Extender SupabaseLoanRepository.test.ts (registerInstallmentPayment, payoffLoan)"
Task: "Extender SupabasePortfolioReader.test.ts (getTrend)"
Task: "Extender SupabaseClientRepository.test.ts (saldo con cuota parcial)"

# Implementaciones en paralelo (una vez sus tests existen):
Task: "Implementar registerInstallmentPayment/payoffLoan en SupabaseLoanRepository.ts"
Task: "Implementar getTrend en SupabasePortfolioReader.ts"
Task: "Corregir computePortfolio en SupabaseClientRepository.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 + User Story 2 — ambas P1)

Igual que en fases anteriores: sin la Historia 2, un préstamo que el cliente quiere saldar antes de tiempo sigue siendo un proceso manual cuota por cuota, así que el MVP real de esta fase es Phase 3 + Phase 4 juntas.

1. Completar Phase 1: Setup
2. Completar Phase 2: Foundational (crítico — extiende el guard de concurrencia y corrige los dos lugares que rompían con `'parcial'`)
3. Completar Phase 3: User Story 1 (pagos parciales)
4. Completar Phase 4: User Story 2 (liquidación anticipada)
5. **STOP and VALIDATE**: correr `quickstart.md` §US1 y §US2 de punta a punta, incluida la prueba de concurrencia de liquidación anticipada
6. Demo/uso real desde ambas apps con la misma cartera de prueba de fases anteriores

### Incremental Delivery

1. Setup + Foundational → fundación lista, dashboard/saldos existentes siguen correctos (regresión verificada en T028)
2. + US1 → probar independientemente → demo (pagos parciales)
3. + US2 → probar independientemente → demo (MVP funcional completo de esta fase)
4. + US3 → probar independientemente → demo (tendencia de cartera)
5. Polish → validación end-to-end con concurrencia real, lint, regresión de fases anteriores, actualización de `spec.md` raíz

### Parallel Team Strategy

Con más de una persona: completar Setup + Foundational en conjunto (la migración SQL y la corrección de los dos bugs de saldo son las piezas más riesgosas — conviene no paralelizarlas con las historias de usuario); luego repartir US1/US2/US3, coordinando solo en `LoanAmortizationPage.tsx` (tocado por US1 y US2) y en el modal de registrar cobro de `apps/mobile` (tocado por US1 y US2).

---

## Notes

- `[P]` = archivos distintos, sin dependencias pendientes
- La etiqueta `[Story]` mapea cada tarea a su historia para trazabilidad
- Verificar que los tests fallan antes de implementar (T004, T005, T006, T012, T018, T023)
- Commitear tras cada tarea o grupo lógico
- T002/T009/T011 corrigen código de fases anteriores que asumía un estado binario pendiente/pagado — no son alcance nuevo, son una consecuencia necesaria de introducir `'parcial'` (ver `data-model.md`); T028 verifica explícitamente que esa corrección no cambió el comportamiento para carteras sin ningún pago parcial
