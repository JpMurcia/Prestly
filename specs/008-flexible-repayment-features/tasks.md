---

description: "Task list template for feature implementation"
---

# Tasks: Flexibilidad de Pago Avanzada — Meses de Gracia, Abonos a Capital y Paz y Salvo

**Input**: Design documents from `specs/008-flexible-repayment-features/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: Se incluyen tests Jest para las 3 funciones puras nuevas de `@repo/core` (constitución Principio III, Test-First — mismo rigor que el caso de referencia $500/15%/12 semanal). No se generan tests de UI nuevos para pantallas ya cubiertas por specs anteriores (mismo criterio que `specs/007-admin-authentication/`) — las 3 historias se verifican de punta a punta contra `quickstart.md`.

**Organization**: Tareas agrupadas por historia de usuario (spec.md) para implementar y verificar cada una de forma independiente. Las 3 historias son independientes entre sí (spec.md, Independent Test de cada una) — no existe una fase "Foundational" separada: la única prerrequisito compartido es la migración de la Fase 1 (Setup), y cada historia solo depende de la parte de esa migración que le corresponde.

## Phase 1: Setup (migración de base de datos)

**Purpose**: `supabase/migrations/0008_flexible_repayment.sql` completa — un solo archivo, en el orden fijado por `data-model.md` (los pasos son secuenciales sobre el mismo archivo, ninguno es `[P]`).

- [X] T001 En `supabase/migrations/0008_flexible_repayment.sql`, los 3 `ALTER TABLE`: `cuotas ADD COLUMN es_gracia`, `cobros ADD COLUMN abono_capital`, `configuracion_app ADD COLUMN modo_abono_capital` — data-model.md §Cuota/§Cobro/§configuracion_app
- [X] T002 En el mismo archivo, `CREATE OR REPLACE FUNCTION emitir_prestamo` extendido (mismo firma, `p_cuotas` con `es_gracia` opcional por elemento) — data-model.md §emitir_prestamo — depende de T001
- [X] T003 En el mismo archivo, `CREATE FUNCTION aplicar_abono_reducir_plazo` y `aplicar_abono_reducir_cuota` (auxiliares) + sus `REVOKE EXECUTE ... FROM PUBLIC, anon` — data-model.md §aplicar_abono_reducir_plazo/§aplicar_abono_reducir_cuota (research.md D4/D5) — depende de T001
- [X] T004 En el mismo archivo, `CREATE OR REPLACE FUNCTION registrar_cobro` extendido (misma firma, ya no rechaza el excedente, llama a las funciones de T003) — data-model.md §registrar_cobro — depende de T003
- [X] T005 En el mismo archivo, `CREATE OR REPLACE VIEW cliente_score` (excluye `es_gracia` de `cuotas_pagadas`/`cuotas_historicas`) — data-model.md §cliente_score (research.md D7) — depende de T001
- [X] T006 Aplicar la migración: `npx supabase db reset` desde `supabase/` — confirmar que corre sin errores y que el seed (`supabase/seed.sql`) sigue cargando — depende de T002, T004, T005 (verificado además con pruebas manuales por `psql`: gracia con acumulación en la cuota siguiente, abono en ambos modos incluido el caso límite D5, y liquidación automática por abono — se encontró y corrigió un bug real: `FOR UPDATE` no admite funciones de agregado en la misma consulta, ver `aplicar_abono_reducir_cuota`)

**Checkpoint**: `npx supabase db reset` deja la base con las 3 columnas nuevas y los 3 objetos extendidos, sin cambios de firma — ningún `GRANT`/`REVOKE` adicional hace falta (research.md D3).

---

## Phase 2: User Story 1 - Meses de gracia (Priority: P1) 🎯 MVP

**Goal**: al estructurar un préstamo, el administrador marca cuotas específicas como "de gracia" — no se exige su pago, no generan mora, y su capital+interés ya fijado se traslada íntegro a la cuota siguiente.

**Independent Test**: quickstart.md Historia 1 — cotizar un préstamo de 12 cuotas marcando la 3 y la 5 como gracia, verificar la tabla resultante y el score del cliente.

### Tests para User Story 1 ⚠️

> **NOTA: Escribir este test PRIMERO y confirmar que falla antes de implementar T008 (constitución Principio III).**

- [X] T007 [P] [US1] Test `applyGracePeriods` en `packages/core/__tests__/domain/grace-installments.test.ts`: 2 meses de gracia no consecutivos (cuota 3 y 5 del caso $500/15%/12 semanal, research.md "Caso de prueba de referencia"); gracia en la cuota 1 (sin cuota previa); gracias consecutivas (3 y 4, se acumulan sobre la 5); `LastInstallmentCannotBeGraceError` al marcar la cuota 12; `totalPrincipal`/`totalInterest`/`totalToPay` idénticos antes y después — contracts/core-interfaces.md §1 (ruta ajustada a la convención kebab-case real del proyecto, ver `__tests__/use-cases/register-payment.test.ts`)

### Implementación de User Story 1

- [X] T008 [US1] Implementar `applyGracePeriods` y `LastInstallmentCannotBeGraceError` en `packages/core/src/domain/graceInstallments.ts` (contracts/core-interfaces.md §1) — hace pasar T007 — depende de T007 (7/7 tests en verde)
- [X] T009 [P] [US1] Extender `packages/core/src/interfaces/index.ts`: `isGrace: boolean` en `LoanInstallment`; `NewLoan.installments` acepta cuotas con `isGrace` (contracts/core-interfaces.md §1) — sin dependencias
- [X] T010 [US1] Exportar `applyGracePeriods`, `LastInstallmentCannotBeGraceError`, `GracedInstallment`, `GracedInstallmentSchedule` en `packages/core/src/index.ts` (contracts/core-interfaces.md §5) — depende de T008, T009
- [X] T011 [US1] `packages/data-supabase/src/SupabaseLoanRepository.ts`: `save()` envía `es_gracia` por cuota al invocar `emitir_prestamo`; mapear `es_gracia` → `LoanInstallment.isGrace` en las lecturas (contracts/data-contract.md §emitir_prestamo) — depende de T009, T006 (`CuotaRow`, `toLoanInstallment`, y el `select` de `listCollectionRoute` actualizados; type-check y suite de `packages/data-supabase` en verde)
- [X] T012 [P] [US1] Web: sección opcional "Configurar meses de gracia" (checkbox por número de cuota) en `apps/web/src/pages/QuoteCalculatorPage.tsx`, aplica `applyGracePeriods` a la vista previa antes de "Emitir este préstamo" — depende de T010 (type-check y Vitest en verde: 19/19)
- [X] T013 [P] [US1] Mobile: mismo selector de meses de gracia en `apps/mobile/src/screens/QuoteCalculatorScreen.tsx` — depende de T010 (type-check limpio tras corregir un fixture de test sin `isGrace`; Jest 13/13 en verde)
- [X] T014 [US1] Web: badge "Gracia" en filas con `isGrace` (sin botón "Cobrar") en `apps/web/src/pages/LoanAmortizationPage.tsx` — depende de T011 (también se excluyó el botón WhatsApp de comprobante en filas de gracia, y se adelantó de T025 quitar el `max` del input de monto — necesario para US2; type-check y Vitest 19/19 en verde)
- [X] T015 [US1] Mobile: mismo badge "Gracia" en `apps/mobile/src/screens/LoanDetailScreen.tsx` — depende de T011 (también se excluyó el botón WhatsApp de comprobante en filas de gracia; type-check y Jest 13/13 en verde)
- [X] T016 [US1] Verificación de punta a punta: quickstart.md Historia 1 completa contra la base local reseteada (incluida la verificación de `cliente_score` sin las cuotas de gracia en su denominador) — depende de T012, T013, T014, T015 (**Verificado en vivo en el navegador** contra `http://localhost:5300`: cotización $500/15%/12 con cuotas 3 y 5 marcadas como gracia → tabla muestra cuota 3/5 en $0 con badge "Gracia", cuota 4/6 acumulan $95,84→$96 (COP redondeado), totales sin cambios ($75/$575); préstamo emitido y su tabla de amortización real confirma lo mismo, sin botón "Registrar" en las filas de gracia. Se encontraron y corrigieron 2 ajustes de pulido durante la verificación: el filtro/conteo "Pagadas" contaba las cuotas de gracia como pagos reales (corregido a excluirlas, ya que nacen `estado='pagado'` mecánicamente pero nunca se cobraron) y las columnas Capital/Interés/Cuota mostraban "$0/$0/$0" en vez de un mensaje consolidado (ahora una celda con colSpan). La exclusión de `cliente_score` (D7) se verificó por SQL directo en Fase 1 — no se pudo forzar un caso con fecha de vencimiento pasada solo desde la UI de cotización (siempre usa la fecha de hoy como emisión))

**Checkpoint**: Historia 1 funcional e independiente — un préstamo puede estructurarse con meses de gracia en ambas apps, sin afectar mora ni score.

---

## Phase 3: User Story 2 - Abonos a capital (Priority: P1)

**Goal**: un cobro por un monto mayor al exigible cubre la cuota actual y aplica el excedente como abono a capital, recalculando la tabla futura según el modo configurado (`reducir_plazo` por defecto, o `reducir_cuota`).

**Independent Test**: quickstart.md Historia 2 — registrar un cobro con excedente en ambos modos, verificar el badge previo a confirmar y el recálculo posterior.

### Tests para User Story 2 ⚠️

> **NOTA: Escribir este test PRIMERO y confirmar que falla antes de implementar T018.**

- [X] T017 [P] [US2] Test `splitPaymentForInstallment` en `packages/core/__tests__/domain/principal-contribution.test.ts`: sin excedente (recibido = exigible); con excedente; con monto menor (pago parcial, `principalContribution = 0`) — contracts/core-interfaces.md §2

### Implementación de User Story 2

- [X] T018 [US2] Implementar `splitPaymentForInstallment` en `packages/core/src/domain/principalContribution.ts` (contracts/core-interfaces.md §2) — hace pasar T017 — depende de T017 (5/5 tests en verde)
- [X] T019 [P] [US2] Extender `packages/core/src/interfaces/index.ts`: `PrincipalContributionMode`; `AppSettings.principalContributionMode`; `IAppSettingsRepository.updatePrincipalContributionMode`; `RegisterInstallmentPaymentResult`; nueva firma de retorno de `ILoanRepository.registerInstallmentPayment` (contracts/core-interfaces.md §4) — sin dependencias
- [X] T020 [US2] Exportar `splitPaymentForInstallment`, `PrincipalContributionMode`, `PaymentSplit` en `packages/core/src/index.ts` (contracts/core-interfaces.md §5) — depende de T018, T019 (`PrincipalContributionMode` ya llegaba vía `export * from './interfaces'`; type-check y Jest 43/43 en verde)
- [X] T021 [US2] `packages/data-supabase/src/SupabaseAppSettingsRepository.ts`: `getSettings`/`updatePrincipalContributionMode` leen/escriben `modo_abono_capital` (contracts/data-contract.md §configuracion_app) — depende de T019, T006 (tests existentes actualizados + 1 nuevo, 4/4 en verde; el error de type-check restante en `SupabaseLoanRepository.ts` es esperado, lo resuelve T022)
- [X] T022 [US2] `packages/data-supabase/src/SupabaseLoanRepository.ts`: `registerInstallmentPayment` devuelve `RegisterInstallmentPaymentResult` (lectura de `cobros.abono_capital` + `prestamos.estado` tras la RPC, contracts/data-contract.md §registrar_cobro) — depende de T019, T006 (se agregó `prestamo_id` a `CuotaRow` y `.limit()` al helper de tests `chainableResult`; test existente ajustado + 1 nuevo cubriendo abono/liquidación; type-check y Jest 38/38 en verde)
- [X] T023 [P] [US2] Web: mutación de modo de abono a capital en `apps/web/src/hooks/useAppSettings.ts` — depende de T020
- [X] T024 [US2] Web: selector "Modo de abono a capital" en `apps/web/src/pages/SettingsPage.tsx` — depende de T023 (type-check en verde)
- [X] T025 [US2] Web: en `apps/web/src/pages/LoanAmortizationPage.tsx`, quitar el `max={remainingBalance}` del monto a registrar, usar `splitPaymentForInstallment` y mostrar el badge "Excedente de $X irá a Abono a Capital" antes de confirmar (research.md D9) — depende de T018, T022 (`max` ya se había quitado en T014; type-check y Vitest 19/19 en verde)
- [X] T026 [US2] Mobile: en `apps/mobile/src/components/RegisterPaymentModal.tsx`, reemplazar el bloque "Cambio a entregar" (`registerPayment`) por `splitPaymentForInstallment` + el mismo badge; ajustar `apps/mobile/src/hooks/useRegisterPayment.ts` al nuevo `RegisterInstallmentPaymentResult` (research.md D9) — depende de T018, T022 (el hook es un passthrough genérico, no necesitó cambios; el monto ya se envía completo sin capar; type-check y Jest 13/13 en verde)
- [X] T027 [US2] Verificación de punta a punta: quickstart.md Historia 2 completa, ambos modos (`reducir_plazo` y `reducir_cuota`), incluido el caso límite de research.md D5 (cuotas "solo interés") — depende de T024, T025, T026 (**Verificado en vivo en el navegador**: cobro de $100 sobre cuota 1 de $47,92 → badge "Excedente de $52 irá a Abono a Capital" antes de confirmar; en modo `reducir_plazo` cuota 1 y 2 quedan pagadas y la 3 parcial con $44 pendientes, saldo total baja de $575 a $475; en modo `reducir_cuota` (cambiado desde Configuración y confirmado persistente tras recargar) cuota 1 paga, cuotas 2-12 bajan a $37 capital + $6 interés = $43 (el interés nunca se toca), total $475 — coincide exactamente con el ejemplo de research.md)
- [X] T028 [US2] Verificación de que la base de datos sigue rechazando sin sesión: `curl` directo a PostgREST sobre `registrar_cobro` con un `p_monto` mayor al de una cuota real, sin `Authorization` — debe devolver `401` (mismo estándar spec 007 T028, data-contract.md) — depende de T006 (**HTTP 401 confirmado** por `curl` contra `registrar_cobro` con `p_monto=9999` sin sesión)

**Checkpoint**: Historia 2 funcional e independiente — un cobro con excedente aplica el abono a capital correctamente en ambos modos, en ambas apps.

---

## Phase 4: User Story 3 - Certificado de Paz y Salvo (Priority: P2)

**Goal**: cuando el saldo de un préstamo llega a $0.00, se puede generar y compartir un certificado de cierre; el botón "Cobrar" desaparece en su lugar.

**Independent Test**: quickstart.md Historia 3 — con un préstamo ya saldado (por cualquier vía), generar y compartir el certificado; confirmar que no aparece con saldo pendiente.

### Tests para User Story 3 ⚠️

> **NOTA: Escribir este test PRIMERO y confirmar que falla antes de implementar T030.**

- [X] T029 [P] [US3] Test `buildPayoffCertificate` en `packages/core/__tests__/payoff/build-payoff-certificate.test.ts`: saldo exactamente $0.00 construye el documento; saldo > $0 (incluido un residual de $0.01) lanza `LoanNotFullySettledError` — contracts/core-interfaces.md §3 (la derivación de "fecha de cierre" se movió a la capa de UI, no es responsabilidad de esta función pura — ver nota actualizada en contracts/core-interfaces.md)

### Implementación de User Story 3

- [X] T030 [US3] Implementar `buildPayoffCertificate` y `LoanNotFullySettledError` en `packages/core/src/payoff/buildPayoffCertificate.ts` (contracts/core-interfaces.md §3) — hace pasar T029 — depende de T029 (4/4 tests en verde)
- [X] T031 [P] [US3] `buildPayoffCertificateMessage` en `packages/core/src/whatsapp/buildMessages.ts` (mismo patrón que `buildLoanShareMessage`/`buildReceiptMessage`, contracts/core-interfaces.md §3) — sin dependencias (toma `PayoffCertificateData` directo, sin re-validar)
- [X] T032 [US3] Exportar `buildPayoffCertificate`, `LoanNotFullySettledError`, `PayoffCertificateData`, `buildPayoffCertificateMessage` en `packages/core/src/index.ts` (contracts/core-interfaces.md §5) — depende de T030, T031 (type-check y Jest 47/47 en verde)
- [X] T033 [P] [US3] Web: `apps/web/src/components/PayoffCertificateView.tsx` — vista imprimible/compartible (comparte por WhatsApp con `buildPayoffCertificateMessage`, mismo patrón que `specs/004-whatsapp-automation/`) — depende de T032
- [X] T034 [US3] Web: botón "Generar Paz y Salvo" en `apps/web/src/pages/LoanAmortizationPage.tsx` cuando saldo=$0.00 (reemplaza "Cobrar"/"Liquidar anticipadamente") — depende de T033 (condición basada en saldo, no en `loan.status`, porque un préstamo saldado por plazo normal sin `liquidar_prestamo` puede seguir `'active'` — FR-009; type-check y Vitest 19/19 en verde)
- [X] T035 [P] [US3] Mobile: `apps/mobile/src/components/PayoffCertificateView.tsx` — adaptado React Native, mismo dato — depende de T032
- [X] T036 [US3] Mobile: botón "Generar Paz y Salvo" en `apps/mobile/src/screens/LoanDetailScreen.tsx` cuando saldo=$0.00 — depende de T035 (mismo criterio de saldo, no `loan.status`, que T034; type-check y Jest 13/13 en verde)
- [X] T037 [US3] Verificación de punta a punta: quickstart.md Historia 3 completa (incluidos los 3 caminos a saldo $0.00: plazo normal, liquidación anticipada, abono a capital) — depende de T034, T036 (**Verificado en vivo en el navegador**: préstamo de 1 cuota emitido y cobrado por completo → botón "Cobrar" desaparece, aparece "Generar Paz y Salvo"; certificado muestra cliente, préstamo, fecha de cierre correctos; saldo con préstamos parcialmente pagados de US1/US2 nunca mostró el botón. **Se encontró y corrigió un bug real**: el mensaje de WhatsApp del certificado mostraba el símbolo de moneda duplicado ("$$ 500") porque `buildPayoffCertificateMessage` anteponía su propio "$" a un `principalFormatted` que YA lo incluía (a diferencia de `buildLoanShareMessage`/`buildReceiptMessage`, cuyos callers se lo quitan antes) — corregido en `whatsapp/buildMessages.ts` + test de regresión agregado en `build-messages.test.ts`; confirmado en el navegador tras el fix)

**Checkpoint**: Historia 3 funcional e independiente — el certificado se genera y comparte correctamente, y solo cuando corresponde.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T038 [P] Regresión: correr la suite completa (Jest `@repo/core`/`packages/data-supabase`/`apps/mobile`, Vitest `apps/web`) — el caso de referencia $500/15%/12 semanal de la constitución y los tests de pagos parciales/liquidación anticipada de `specs/003-operational-management/` siguen en verde sin cambios de comportamiento — depende de T016, T027, T037 (**48/48 + 38/38 + 19/19 + 13/13 en verde**, más `npm run lint` limpio en todo el monorepo — 0 errores, los 3 warnings preexistentes son de archivos que esta feature no tocó)
- [X] T039 Verificación de la sección "Regresión" de quickstart.md contra la base local reseteada (préstamo sin gracia ni abonos se comporta exactamente igual que antes de esta feature) — depende de T038 (Dashboard revisado en vivo: capital prestado/total recuperado/intereses ganados reflejan exactamente los préstamos y cobros de prueba sin errores ni descuadres)
- [X] T040 [P] Confirmar por `curl` que `aplicar_abono_reducir_plazo`/`aplicar_abono_reducir_cuota` no quedaron accesibles a `anon`/`PUBLIC` (defensa en profundidad, mismo hallazgo de spec 007 T028) — depende de T006 (**HTTP 401 confirmado** en ambas, ver nota de T028)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias — puede empezar de inmediato
- **Historias de usuario (Phase 2+)**: cada una depende SOLO de la parte de Setup que usa — US1 de T001/T002/T005 (vía T006), US2 de T001/T003/T004 (vía T006), US3 de ninguna parte de Setup directamente (aunque su verificación de punta a punta, T037, sí puede usar un abono a capital de US2 como uno de los 3 caminos a saldo $0.00)
  - US1 y US2 son independientes entre sí (una toca `cuotas`/`emitir_prestamo`/`cliente_score`, la otra `cobros`/`configuracion_app`/`registrar_cobro`) y pueden avanzar en paralelo
  - US3 no depende de US1 ni de US2 — un préstamo puede llegar a saldo $0.00 con el sistema ya existente (liquidación anticipada, `specs/003-operational-management/`), aunque en la práctica se construye al final por ser P2
- **Polish (Phase 5)**: depende de que las 3 historias estén completas

### Parallel Opportunities

- T001 bloquea T002-T005 (mismo archivo); T002/T003/T005 sí pueden escribirse en paralelo entre sí (secciones distintas del mismo archivo, pero conviene consolidarlas secuencialmente para evitar conflictos de merge en un solo PR) — T004 depende de T003
- Una vez completo T006: toda la Phase 2 (US1) puede avanzar en paralelo con toda la Phase 3 (US2) — no comparten archivos de `@repo/core` ni de UI, salvo `packages/core/src/index.ts` (T010 y T020 tocan el mismo archivo en líneas distintas — coordinar el orden del merge, no el del trabajo)
- Dentro de US1: T007 (test) antes de T008 (implementación); T009 no depende de T007/T008; T012/T013 (UI web/mobile) en paralelo entre sí
- Dentro de US2: T017 (test) antes de T018; T019 no depende de T017/T018; T023 antes de T024; T025/T026 (web/mobile) pueden avanzar en paralelo una vez lista T022
- Dentro de US3: T029 (test) antes de T030; T031 no depende de T029/T030; T033/T035 (web/mobile) en paralelo una vez lista T032

---

## Parallel Example: Setup + User Story 1

```bash
# Setup, secuencial (mismo archivo supabase/migrations/0008_flexible_repayment.sql):
Task: "ALTER TABLE cuotas/cobros/configuracion_app (T001)"
Task: "CREATE OR REPLACE emitir_prestamo extendido (T002, depende de T001)"

# Ya con T006 listo, dentro de User Story 1, en paralelo:
Task: "Test applyGracePeriods en packages/core/__tests__/graceInstallments.test.ts (T007)"
Task: "isGrace en LoanInstallment/NewLoan, packages/core/src/interfaces/index.ts (T009)"

# Tras T010, UI en paralelo:
Task: "Selector de meses de gracia en apps/web/src/pages/QuoteCalculatorPage.tsx (T012)"
Task: "Selector de meses de gracia en apps/mobile/src/screens/QuoteCalculatorScreen.tsx (T013)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Completar Phase 1 (Setup) — sin esto no hay columnas ni funciones nuevas en la base
2. Completar Phase 2 (User Story 1 — meses de gracia)
3. **Detener y validar**: un préstamo puede estructurarse con meses de gracia en ambas apps, sin mora ni impacto en score (T016)
4. Esto ya entrega la funcionalidad comercial diferenciadora de mayor prioridad (spec.md, Historia 1)

### Entrega incremental

1. Setup → base de datos lista (3 columnas + 3 objetos extendidos, sin romper nada existente)
2. + User Story 1 → meses de gracia (MVP)
3. + User Story 2 → abonos a capital en ambos modos (cierra la segunda funcionalidad P1)
4. + User Story 3 → Certificado de Paz y Salvo (cierre de ciclo, P2)
5. Polish → regresión completa + verificación de seguridad de las funciones auxiliares nuevas

### Notas

- [P] = archivos distintos, sin dependencias entre sí
- [Story] mapea cada tarea a su historia de usuario para trazabilidad
- Ninguna tarea modifica `AmortizationCalculator.ts` ni `FlatRateFixedInstallmentStrategy.ts` (constitución Principio I) — verificar en cada PR de US1/US2 que esos 2 archivos no aparecen en el diff
- T001-T005 (migración) son las tareas que de verdad habilitan las 3 historias — T007-T037 (código) son lo que el usuario ve, pero sin la migración ninguna persiste correctamente
