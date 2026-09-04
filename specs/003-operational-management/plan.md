# Implementation Plan: Gestión Operativa Integral — Pagos Parciales, Liquidación Anticipada y Tendencia de Cartera

**Branch**: `003-operational-management` | **Date**: 2026-09-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-operational-management/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Extiende el registro de cobro (hoy binario: pendiente/pagado) para admitir pagos parciales sucesivos y liquidación anticipada de un préstamo completo, y añade un panel de tendencia mensual (capital prestado, recuperado, intereses) al dashboard de `apps/web` — las 3 historias de usuario de [spec.md](./spec.md), disponibles desde `apps/mobile` y `apps/web` sobre el mismo `@repo/core`/`packages/data-supabase`/Supabase.

**Efecto colateral necesario, no alcance nuevo**: `cartera_resumen` (`specs/002-admin-web/`) y el cálculo de saldo de cliente (`SupabaseClientRepository.computePortfolio`, `apps/web/src/lib/loanStatus.ts`) asumen hoy que solo `estado = 'pagado'` aporta dinero cobrado — una vez existe `'parcial'`, esa suposición queda rota (dinero real cobrado desaparecería del dashboard, saldos se verían inflados). Se corrigen como parte de esta fase, no como alcance añadido — ver `data-model.md`.

**Dependencia crítica**: el guard de concurrencia existente (`registrar_cobro`, `UPDATE ... WHERE estado = 'pendiente'`) solo conoce dos estados. Este plan lo extiende en el mismo procedimiento (no lo reemplaza) para que reconozca un tercer estado `parcial` y acepte un monto explícito, y añade un segundo procedimiento (`liquidar_prestamo`) que reutiliza esa misma función cuota por cuota dentro de una sola transacción — ver Complexity Tracking y `research.md` §1-§3 para el razonamiento completo, incluida la resolución del caso de carrera entre una liquidación anticipada y un cobro individual concurrente sobre la misma cuota.

## Technical Context

**Language/Version**: TypeScript ~6.0 (monorepo); React 19.2.8 (`apps/web`); React Native vía Expo (`apps/mobile`); PL/pgSQL (Postgres, procedimientos)

**Primary Dependencies**: `@repo/core` (tipos extendidos: `InstallmentStatus` con `'partial'`, dos métodos nuevos en `ILoanRepository`, un método nuevo en `IPortfolioReader`); `@repo/data-supabase` (implementación concreta extendida); `recharts` (NUEVA, solo `apps/web`, para el panel de tendencia — ver `research.md` §5); ninguna dependencia nueva en `apps/mobile`

**Storage**: PostgreSQL vía Supabase — mismo stack que fases anteriores. Se añade una tabla nueva (`cobros`, historial de pagos por cuota) y se extiende `registrar_cobro` + se añade `liquidar_prestamo` + una vista nueva (`cartera_tendencia_mensual`) en `supabase/migrations/0004_pagos_parciales.sql`; ninguna tabla ni función existente se elimina.

**Testing**: Jest para `packages/data-supabase` (mapeo fila↔dominio, mismo criterio que fases anteriores — código que mueve dinero); Vitest + Testing Library para `apps/web` (un test de integración por historia de usuario); Jest + jest-expo para `apps/mobile` (regresión de las pantallas que hoy llaman `markInstallmentPaid`); `packages/core` solo gana tipos/firmas, sin lógica de cálculo nueva (mismo razonamiento que `specs/002-admin-web/tasks.md`, constitución Principio III) — sin test Jest nuevo ahí.

**Target Platform**: mismos targets que fases anteriores — `apps/web` en navegadores de escritorio (puerto 5300/5301), `apps/mobile` en iOS/Android vía Expo.

**Project Type**: monorepo Turborepo — toca `apps/web`, `apps/mobile`, extiende `packages/core` (tipos) y `packages/data-supabase` (implementación + tabla/procedimientos nuevos), sin paquetes nuevos.

**Performance Goals**: registrar un pago parcial o liquidar anticipadamente en <30s/<1min respectivamente (SC-001/SC-002, percibido); panel de tendencia visible en <5s (SC-005).

**Constraints**: todo cálculo financiero mostrado DEBE pasar por `@repo/core` o por el mismo procedimiento de Postgres reutilizado por ambas apps, nunca reimplementado por separado en `apps/web`/`apps/mobile` (FR-011/FR-012); el reparto capital/interés de un pago parcial y el cómputo del monto de liquidación anticipada ocurren en una sola transacción atómica de Postgres — no en dos pasos (leer, luego escribir) que un cobro concurrente pudiera intercalar.

**Scale/Scope**: misma cartera "pequeña y manejable" que fases anteriores; 3 historias de usuario; extiende 2 pantallas ya existentes (tabla de amortización/registro de cobro en ambas apps) y añade 1 panel nuevo (tendencia, solo web) + 1 acción nueva (liquidar anticipadamente, ambas apps).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Evaluación | Resultado |
|---|---|---|
| I. SOLID estricto en `@repo/core` (NON-NEGOTIABLE) | Los tipos nuevos (`InstallmentStatus` extendido, `PortfolioTrendPoint`) y los 2 métodos nuevos de `ILoanRepository` son solo firmas — sin React, sin cliente de Supabase, sin lógica de cálculo. `getTrend()` se añade a `IPortfolioReader` existente (mismo agregado de solo-lectura del dashboard, no una operación nueva de escritura) en vez de crear una interfaz separada — ISP ya satisfecho por el diseño de `specs/002-admin-web/` | PASS |
| II. Motor financiero único | El reparto proporcional capital/interés de un pago parcial y la suma de saldos para liquidación anticipada son operaciones aritméticas simples (una razón, una suma) que corren **dentro** de la misma transacción atómica de Postgres que ya aplica el pago — no son fórmulas de amortización nuevas que deban vivir en `@repo/core` (que no puede participar en una transacción de Postgres). `@repo/core` sigue siendo la única fuente de las fórmulas de cotización/amortización; esta fase no las toca | PASS — ver `research.md` §2 para el razonamiento completo |
| III. Test-First para el motor financiero (NON-NEGOTIABLE) | `packages/core` no gana lógica de cálculo nueva (solo tipos), igual que `specs/002-admin-web/` — sin test Jest nuevo ahí, bajo el mismo razonamiento ya aceptado. `packages/data-supabase` sí gana lógica de mapeo nueva (nuevo estado `parcial`, nuevos métodos) — Test-First aplica ahí igual que en fases anteriores | PASS |
| IV. Estado derivado sobre estado almacenado | `cartera_tendencia_mensual` es una `VIEW`, igual patrón que `cliente_score`/`cartera_resumen` — nunca una tabla que un job deba mantener. La tabla nueva `cobros` no es una excepción a este principio: es un **hecho crudo** (qué se cobró y cuándo, uno por evento), la misma categoría que `cuotas`/`prestamos` ya son hoy — no un agregado que debiera derivarse; `cuotas.monto_pagado`/`estado` siguen siendo la vista resumida de ese historial, mantenida transaccionalmente por el mismo procedimiento que inserta en `cobros` (igual patrón que ya existe hoy, solo que ahora acumula en vez de fijar un único valor) | PASS |
| V. Simplicidad (YAGNI) | El principio V nombra explícitamente "pagos parciales" como algo que no se construye hasta que "esa fase llegue" — esta es esa fase (Fase 4 del roadmap de negocio). Se añade `recharts` (1 dependencia nueva, solo para el panel de tendencia de `apps/web`) en vez de graficar a mano con SVG — justificado en Complexity Tracking | Ver Complexity Tracking — justificado |
| Restricciones técnicas | Sin cambios — mismo stack, mismos puertos, misma nomenclatura española en BD / inglesa en `@repo/core` | PASS |

**Post-Design Constitution Check** *(tras Fase 1)*: `data-model.md` confirma que la única tabla nueva (`cobros`) almacena hechos crudos por evento de pago, no un agregado; `cartera_tendencia_mensual` sigue siendo una `VIEW` derivada. `contracts/core-interfaces.md` extiende `ILoanRepository`/`IPortfolioReader` sin tocar `IClientReader`/`IClientWriter`/`IInterestStrategy`. Ninguna fórmula financiera se reimplementa fuera de la transacción de Postgres compartida por ambas apps ni fuera de `@repo/core`. Gates siguen en PASS.

## Project Structure

### Documentation (this feature)

```text
specs/003-operational-management/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── contracts/            # Phase 1 output (/speckit-plan command)
│   ├── core-interfaces.md
│   └── data-contract.md
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
packages/core/src/interfaces/index.ts     # InstallmentStatus extendido; 2 métodos nuevos en ILoanRepository; 1 método nuevo en IPortfolioReader

packages/data-supabase/src/
├── SupabaseLoanRepository.ts             # registerInstallmentPayment (reemplaza markInstallmentPaid), payoffLoan (nuevo)
├── SupabasePortfolioReader.ts            # getTrend (nuevo)
└── __tests__/                            # tests actualizados/nuevos para lo anterior

apps/web/src/
├── pages/LoanAmortizationPage.tsx        # input de monto en "Registrar" (no solo botón de pago completo); acción "Liquidar anticipadamente"
├── components/ClientDetailDrawer.tsx     # mismo input de monto reutilizado (comparte hook con LoanAmortizationPage)
├── pages/DashboardPage.tsx               # nuevo panel de tendencia (recharts)
├── hooks/useRegisterPayment.ts           # firma extendida (installmentId, amount)
├── hooks/usePayoffLoan.ts                # NUEVO
└── hooks/usePortfolioTrend.ts            # NUEVO

apps/mobile/src/
├── screens/ClientProfileScreen.tsx       # mismo input de monto en el modal "Registrar cobro" (mockup 1b, pestaña "Parcial")
├── screens/CollectionRouteScreen.tsx     # mismo input de monto
└── hooks/ (equivalentes a los de apps/web para registerInstallmentPayment/payoffLoan)

supabase/migrations/0004_pagos_parciales.sql   # tabla cobros; registrar_cobro extendido; liquidar_prestamo nuevo; vista cartera_tendencia_mensual; backfill de cobros desde cuotas ya pagadas
```

**Structure Decision**: mismo monorepo Turborepo de fases anteriores — ninguna carpeta ni paquete nuevo; esta fase extiende archivos ya existentes en `packages/core`, `packages/data-supabase`, `apps/web` y `apps/mobile`, y añade una sola migración nueva.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Nueva dependencia `recharts` en `apps/web` | US3 (FR-008) pide una gráfica de tendencia con 3 series a lo largo del tiempo — SVG a mano requeriría reimplementar ejes, escalas y tooltips, con más código propio que mantener que una dependencia madura de ~50KB usada solo en un componente | Graficar a mano (SVG manual): más código propio para un problema ya resuelto, mayor superficie de bugs de cálculo de escalas/ejes; no justifica evitar una dependencia bien establecida para un panel de solo-lectura |
| Nueva tabla `cobros` (en vez de solo extender columnas de `cuotas`) | FR-003 exige varios abonos parciales sucesivos sobre la misma cuota — un único par de columnas (`monto_pagado`/`fecha_pago`) no puede representar más de un evento de pago con su propia fecha; además, el panel de tendencia (US3) necesita fechas de cobro reales para agrupar por mes, que una sola `fecha_pago` por cuota ya no puede dar una vez que un pago se parte en varios | Seguir usando solo `cuotas.monto_pagado` como acumulador sin historial: pierde la fecha de cada abono individual (rompe la tendencia mensual, US3) y no deja auditar cuántos abonos hubo ni cuándo — inaceptable para código que mueve dinero |
