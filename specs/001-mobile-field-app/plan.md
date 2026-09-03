# Implementation Plan: App Móvil de Cobranza en Campo

**Branch**: `001-mobile-field-app` | **Date**: 2026-09-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-mobile-field-app/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Construir la app móvil (Expo/React Native) que un prestamista usa en campo para cotizar y emitir préstamos, cobrar cuotas en una ruta diaria priorizada, consultar el directorio/cartera de clientes y revisar el perfil 360° (score de confianza + historial) de cada uno — las 4 historias de usuario de [spec.md](./spec.md).

**Dependencia crítica**: ninguna de las 4 historias puede construirse ni probarse sin (a) el motor financiero real de `@repo/core` (`AmortizationCalculator`, interfaces `ILoanRepository`/`IClientReader`/`IClientWriter`) y (b) una base de datos real accesible desde la app. Ninguna de las dos existe todavía en el repo — son las "Fase 3 (Docker)" y "Fase 4 (`@repo/core`)" del `spec.md` raíz, que quedaron pendientes y sin otro plan activo que las reclame. Este plan las incluye como prerequisito de ejecución (no como rediseño: su esquema y sus fórmulas ya están 100% fijados en `spec.md` raíz §4–§6, solo falta implementarlos) — ver Complexity Tracking.

## Technical Context

**Language/Version**: TypeScript ~6.0 (todo el monorepo); React 19.2; React Native 0.86.3 vía Expo SDK 57 (managed workflow)

**Primary Dependencies**: Expo SDK 57 (`expo`, `expo-status-bar`); `@react-navigation/native` + `native-stack` + `bottom-tabs` (navegación); NativeWind (ya previsto en `spec.md` raíz §3 — sistema de diseño Tailwind para RN); `@tanstack/react-query` (estado de servidor/caché); `@react-native-community/netinfo` (detección de conexión, FR-013); `@repo/core` (motor financiero — a implementar en este plan); `@repo/ui` (componentes compartidos — a implementar en este plan); `@supabase/supabase-js` (cliente concreto detrás de `ILoanRepository`/`IClientReader`/`IClientWriter`, vía DIP)

**Storage**: PostgreSQL vía Supabase — producción: proyecto Supabase hosteado; desarrollo: stack local de Supabase (Docker, Postgres en puerto 5432, según la constitución §Restricciones técnicas). El stack local y las migraciones no existen todavía; se crean en este plan reutilizando el DDL ya definido en `spec.md` raíz §4 sin modificarlo.

**Testing**: Jest + `@testing-library/react-native` para pantallas/componentes de `apps/mobile`; Jest para `packages/core` (obligatorio por la constitución, principio III — el caso de referencia $500/15%/12 cuotas → $47.92 debe tener test antes que cualquier otro cambio)

**Target Platform**: iOS 15+ y Android (mínimos por defecto de Expo SDK 57), app nativa vía Expo managed workflow; sin versión web de esta feature (Admin Web es una fase de negocio posterior y separada)

**Project Type**: mobile-app dentro de un monorepo Turborepo — toca `apps/mobile`, `packages/core` y `packages/ui`; no toca `apps/web`

**Performance Goals**: recálculo de la cotización sin bloqueo perceptible al mover un control (FR-001); búsqueda/filtro del directorio con respuesta percibida <100ms (FR-005); flujo completo de cobro (abrir cuota → confirmar) en <30s (SC-002); flujo completo de cotizar+emitir en <2min (SC-001)

**Constraints**: cotizar es 100% local y funciona sin red, verificable en modo avión (FR-001, SC-006); emitir un préstamo y registrar un cobro REQUIEREN conexión activa — si no la hay, la app avisa y no completa la operación hasta confirmar que se guardó, sin duplicar el cobro (FR-013); no se implementan pagos parciales por cuota en esta fase (FR-014); un solo prestamista administrador, sin roles ni multi-usuario (single-tenant)

**Scale/Scope**: cartera "pequeña y manejable" de un único prestamista (decenas a un par de cientos de clientes activos, según `spec.md` raíz §1); 4 historias de usuario; ~7 superficies de UI (calculadora + tabla completa, directorio, ruta de cobranza, modal de registro de cobro, detalle de préstamo, perfil 360°, alta mínima de cliente nuevo)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Evaluación | Resultado |
|---|---|---|
| I. SOLID estricto en `@repo/core` (NON-NEGOTIABLE) | `AmortizationCalculator`, `IInterestStrategy`, `ILoanRepository`, `IClientReader`/`IClientWriter` se implementan dentro de `packages/core`, sin React/React Native/cliente de Supabase — `apps/mobile` solo los consume | PASS |
| II. Motor financiero único | `apps/mobile` importa `@repo/core` para todo cálculo; ninguna fórmula se reimplementa en la app | PASS |
| III. Test-First para el motor financiero (NON-NEGOTIABLE) | El caso $500/15%/12→$47.92 tendrá su test Jest antes de cualquier otro cambio en `packages/core` (se aplica en fase de tareas/implementación) | PASS (a verificar en tasks) |
| IV. Estado derivado sobre estado almacenado | Mora, score y saldo se calculan (vía `VIEW cliente_score` + cálculo en la app), nunca se guardan como columna — ver FR-006/FR-010/data-model.md | PASS |
| V. Simplicidad (YAGNI) | Este plan agrega la implementación de `@repo/core` y del stack local Supabase/Docker, que técnicamente son las Fases 3–4 originales, no la feature de negocio en sí | Ver Complexity Tracking — justificado como prerequisito ineludible, no como alcance nuevo |
| Restricciones técnicas | Turborepo + npm workspaces ✓; Expo para `apps/mobile` ✓; `packages/core` TS+Jest ✓; nomenclatura de tablas en español (`clientes`/`prestamos`/`cuotas`) reutilizada tal cual ✓ | PASS |

**Post-Design Constitution Check** *(tras Fase 1)*: `data-model.md` y `contracts/` reutilizan el esquema y las interfaces ya fijadas en `spec.md` raíz sin alterarlas; no se introduce ningún estado almacenado que debiera ser derivado, ni ninguna dependencia de `apps/mobile` hacia un cliente concreto de Supabase (todo pasa por las interfaces de `packages/core`). Gates siguen en PASS.

## Project Structure

### Documentation (this feature)

```text
specs/001-mobile-field-app/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
apps/mobile/
├── App.tsx                          # entry point: NavigationContainer + QueryClientProvider
├── src/
│   ├── navigation/                   # React Navigation: stack + tabs (Ruta de hoy / Directorio / Calculadora)
│   ├── screens/
│   │   ├── QuoteCalculatorScreen.tsx      # mockups 1a/2a — cotizar, tabla completa, compartir, emitir
│   │   ├── ClientDirectoryScreen.tsx      # mockup 2b — directorio y cartera (US3)
│   │   ├── ClientProfileScreen.tsx        # mockup 2c — perfil 360°, score, notas, historial (US4)
│   │   ├── CollectionRouteScreen.tsx      # mockup 2d — ruta de cobranza diaria (US2)
│   │   └── LoanDetailScreen.tsx           # mockup 1b — detalle de préstamo + modal de registro de cobro
│   ├── components/                   # composición de piezas de @repo/ui específicas de una pantalla
│   ├── hooks/                        # useQuote, useClientDirectory, useCollectionRoute, useRegisterPayment
│   ├── data/                         # implementación de ILoanRepository/IClientReader/IClientWriter (Supabase)
│   └── offline/                      # detección de conexión (netinfo) + aviso de FR-013
└── __tests__/                        # Jest + @testing-library/react-native, uno por pantalla/hook

packages/core/
├── src/
│   ├── domain/                       # AmortizationCalculator + entidades (Loan, Client, Installment)
│   ├── use-cases/                    # cotizar / emitir / cobrar
│   ├── interfaces/                   # IInterestStrategy, ILoanRepository, IClientReader, IClientWriter
│   └── strategies/                   # FlatRateFixedInstallmentStrategy (spec.md raíz §5.1)
└── __tests__/                        # caso de referencia $500/15%/12 → $47.92 (constitución III)

packages/ui/
├── src/
│   ├── primitives/                   # Button, Card, Badge, ProgressBar, Chip, Avatar (multiplataforma)
│   └── tokens/                       # paleta #10B981/#1E3A8A/#0F172A, tipografías (spec.md raíz §9)

supabase/                             # NUEVO — stack local (Fase 3 pendiente, ver Complexity Tracking)
├── docker-compose.yml                # Postgres local en puerto 5432 (constitución §Restricciones técnicas)
└── migrations/                       # DDL de clientes/prestamos/cuotas + VIEW cliente_score (spec.md raíz §4)
```

**Structure Decision**: Monorepo Turborepo existente. Esta feature vive principalmente en `apps/mobile`, con las piezas compartidas (motor financiero + interfaces en `packages/core`, componentes de UI en `packages/ui`) implementadas ahí para que la futura fase Admin Web (`apps/web`) las reutilice sin duplicar. Se añade `supabase/` en la raíz para el stack local de base de datos, que hoy no existe.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Implementar `@repo/core` (motor financiero + interfaces) y el stack local Supabase/Docker dentro de este plan, en vez de esperar a que existan como entregables separados | Ninguna historia de usuario de esta spec (cotizar, emitir, cobrar, consultar cartera, ver perfil) puede construirse ni probarse sin un motor de cálculo real y una base de datos real; su diseño ya está 100% fijado en `spec.md` raíz §4–§6 — no hay ninguna decisión de producto pendiente, solo ejecución | Posponer esta feature hasta que otro trabajo complete esas fases por separado — rechazado porque no hay ningún otro plan activo dueño de ellas y eso bloquearía indefinidamente la única feature de negocio en curso |
