# Implementation Plan: Admin Web — Dashboard y Gestión de Cartera

**Branch**: `002-admin-web` | **Date**: 2026-09-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-admin-web/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Construir el centro de control web (`apps/web`, React + Vite) que un prestamista usa desde escritorio: un dashboard con el panorama financiero de la cartera, la gestión de préstamos activos con su tabla de amortización extendida y registro de cobros, un directorio/CRM de clientes con panel de detalle, y una calculadora de cotización con paridad exacta respecto a la app móvil — las 4 historias de usuario de [spec.md](./spec.md).

**Dependencia crítica**: ninguna historia puede construirse sin (a) dos piezas de datos que hoy no existen en `@repo/core` — listar préstamos activos de todos los clientes y leer un resumen agregado de cartera — y (b) una forma de reutilizar, sin duplicar, la implementación de `ILoanRepository`/`IClientReader` contra Supabase que `apps/mobile` ya construyó en `specs/001-mobile-field-app/` (incluida su guarda de concurrencia, crítica para FR-012/SC-006 de esta spec). Este plan resuelve ambas cosas: extiende las interfaces de `@repo/core` con la superficie mínima que falta, y extrae la implementación concreta ya probada de `apps/mobile/src/data/` hacia un nuevo paquete compartido `packages/data-supabase` — ver Complexity Tracking.

## Technical Context

**Language/Version**: TypeScript ~6.0 (todo el monorepo); React 19.2.8; Vite 8.2 (`apps/web` ya scaffoldeado con este stack)

**Primary Dependencies**: `react-router-dom` (enrutamiento, NUEVO para `apps/web`); `@tanstack/react-query` (estado de servidor/caché, mismo patrón que `apps/mobile`); `@repo/core` (interfaces extendidas — `IPortfolioReader`, `ILoanRepository.listActive`); `@repo/ui` vía un nuevo entry point `@repo/ui/web` (primitivas DOM/Tailwind, NUEVO); `@repo/data-supabase` (implementación concreta compartida con `apps/mobile`, NUEVO paquete); `@supabase/supabase-js` (ya usado indirectamente vía `@repo/data-supabase`); TailwindCSS v4 (ya instalado vía `@tailwindcss/vite`)

**Storage**: PostgreSQL vía Supabase — mismo stack local/producción que `specs/001-mobile-field-app/`, sin cambios de infraestructura. Se añade una única vista nueva (`cartera_resumen`, `supabase/migrations/0003_cartera_resumen.sql`); ninguna tabla, tipo ni función existente se modifica.

**Testing**: Vitest + `@testing-library/react` para páginas/hooks de `apps/web` (NUEVO — idiomático para un proyecto Vite, ver `research.md` §8); Jest para `packages/core` (sin cambios, obligatorio por constitución III) y para el nuevo `packages/data-supabase` (consistencia con `packages/core`); `apps/mobile` sigue con Jest + `jest-expo`, sin cambios de comportamiento esperados tras el refactor a `@repo/data-supabase` (ver quickstart.md, "regresión, no funcionalidad nueva").

**Target Platform**: navegadores de escritorio modernos (Chrome/Edge/Firefox recientes) — los mockups (1c/2e) asumen ventanas anchas (~1420px, barra lateral fija de 232px); sin versión móvil de esta feature (ya cubierta por `apps/mobile` en `specs/001-mobile-field-app/`)

**Project Type**: web-app dentro de un monorepo Turborepo — toca `apps/web`, extiende `packages/core` (interfaces) y `packages/ui` (nuevas primitivas web); añade `packages/data-supabase` (nuevo); refactora `apps/mobile/src/data/` para consumir el paquete extraído en vez de sus copias locales (sin cambio de comportamiento)

**Performance Goals**: dashboard con las 4 métricas visibles en <5s desde que se abre (SC-001); búsqueda/filtro de préstamos o clientes con respuesta percibida <100ms sobre datos ya cargados (mismo objetivo que `spec.md` raíz para el directorio móvil); flujo completo de registrar un cobro en <30s (SC-003); exportar CSV en <5s (SC-004)

**Constraints**: todo cálculo financiero mostrado (cuota, interés, totales, score) DEBE pasar por `@repo/core`, nunca reimplementado en `apps/web` (FR-009); `apps/web` NO DEBE importar `@supabase/supabase-js` fuera de su capa de datos (FR-010); el registro de cobro DEBE reutilizar el mismo guard de concurrencia ya implementado en `registrar_cobro` (FR-012), no uno nuevo; sin autenticación ni roles (single-tenant, igual que `apps/mobile`)

**Scale/Scope**: misma cartera "pequeña y manejable" que `spec.md` raíz §1 (decenas a un par de cientos de clientes activos); 4 historias de usuario; 5 superficies principales (dashboard, lista de préstamos activos, detalle/amortización de un préstamo, directorio con drawer, calculadora) sobre un `AppShell` de barra lateral fija compartido

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Evaluación | Resultado |
|---|---|---|
| I. SOLID estricto en `@repo/core` (NON-NEGOTIABLE) | `IPortfolioReader` (nueva) y `ILoanRepository.listActive` (nuevo método) son solo tipos/firmas en `packages/core`, sin React ni cliente de Supabase; su implementación concreta vive en `packages/data-supabase`, no en `packages/core` | PASS |
| II. Motor financiero único | `apps/web` importa `@repo/core` (`AmortizationCalculator`, `quoteLoan`/`issueLoan`) para toda cotización/emisión (US4); ninguna fórmula se reimplementa en la web | PASS |
| III. Test-First para el motor financiero (NON-NEGOTIABLE) | Los tipos nuevos de `@repo/core` (`IPortfolioReader`, `ActiveLoanSummary`) no añaden lógica de cálculo — son contratos; si `tasks.md` introduce alguna función de agregación en `packages/core`, su test Jest se escribe primero | PASS (a verificar en tasks si aplica) |
| IV. Estado derivado sobre estado almacenado | `cartera_resumen` es una `VIEW` (igual patrón que `cliente_score`), nunca una columna almacenada; saldo y mora se recalculan igual que en spec 001 | PASS |
| V. Simplicidad (YAGNI) | Este plan añade un paquete nuevo (`data-supabase`) y un entry point nuevo (`@repo/ui/web`) — ambos resuelven una necesidad de **esta** fase (reutilizar sin duplicar código ya construido), no una especulación sobre fases futuras — ver Complexity Tracking | Ver Complexity Tracking — justificado |
| Restricciones técnicas | Turborepo + npm workspaces ✓; `apps/web` en puerto 5300 (ya fijado, sin cambios) ✓; Postgres local en 5432 (reutilizado) ✓; nomenclatura de tablas en español reutilizada tal cual ✓ | PASS |

**Post-Design Constitution Check** *(tras Fase 1)*: `data-model.md` solo añade una vista derivada (`cartera_resumen`) y una forma de lectura pre-unida (`listActive`), sin introducir estado almacenado que debiera ser derivado. `contracts/core-interfaces.md` extiende `ILoanRepository` con un método y añade `IPortfolioReader` como interfaz separada (ISP), sin tocar `IClientReader`/`IClientWriter`/`IInterestStrategy`. Ninguna dependencia de `apps/web` hacia un cliente concreto de Supabase — todo pasa por `packages/data-supabase`, que implementa las interfaces de `packages/core`. Gates siguen en PASS.

## Project Structure

### Documentation (this feature)

```text
specs/002-admin-web/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── contracts/            # Phase 1 output (/speckit-plan command)
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
apps/web/
├── src/
│   ├── main.tsx / App.tsx              # existentes — se reescriben para montar Router + QueryClientProvider
│   ├── router.tsx                       # rutas: / (dashboard), /prestamos, /prestamos/:id, /clientes, /calculadora
│   ├── layout/
│   │   └── AppShell.tsx                 # barra lateral fija 232px + contenido (mockups 1c/2e)
│   ├── pages/
│   │   ├── DashboardPage.tsx            # mockup 1c (métricas) — US1
│   │   ├── ActiveLoansPage.tsx          # mockup 1c (tabla superior) — US2, lista + búsqueda
│   │   ├── LoanAmortizationPage.tsx     # mockup 1c (tabla extendida de un préstamo) — US2, detalle + registrar cobro
│   │   ├── ClientDirectoryPage.tsx      # mockup 2e (tabla + drawer) — US3
│   │   └── QuoteCalculatorPage.tsx      # US4 — reusa quoteLoan/issueLoan de @repo/core
│   ├── components/
│   │   ├── ClientDetailDrawer.tsx        # mockup 2e — panel lateral de detalle
│   │   ├── RegisterPaymentModal.tsx      # UI propia web; misma lógica de registerPayment que apps/mobile
│   │   └── ExportCsvButton.tsx           # FR-007 — serialización manual, ver research.md §5
│   ├── hooks/                            # useDashboardSummary, useActiveLoans, useLoanAmortization,
│   │                                      # useClientDirectory, useRegisterPayment, useIssueLoan
│   └── data/
│       └── repositories.ts               # instancia @repo/data-supabase con VITE_SUPABASE_URL/ANON_KEY
└── __tests__/                            # Vitest + @testing-library/react, uno por página

packages/data-supabase/                   # NUEVO — extraído de apps/mobile/src/data (research.md §6)
├── src/
│   ├── createSupabaseClient.ts           # factory: recibe url/anonKey explícitos, no lee process.env
│   ├── SupabaseLoanRepository.ts         # movido desde apps/mobile + nuevo método listActive()
│   ├── SupabaseClientRepository.ts       # movido desde apps/mobile, sin cambios de comportamiento
│   ├── SupabasePortfolioReader.ts        # NUEVO — implementa IPortfolioReader contra VIEW cartera_resumen
│   └── index.ts
└── __tests__/                            # tests de mapeo fila↔dominio (Jest)

packages/core/src/interfaces/index.ts     # + IPortfolioReader, PortfolioSummary, ActiveLoanSummary;
                                           # + ILoanRepository.listActive() — ver contracts/core-interfaces.md

packages/ui/
├── src/
│   ├── primitives-web/                   # NUEVO — versiones DOM/Tailwind de Button/Card/Badge/ProgressBar/Chip/Avatar
│   │                                      # consumen los mismos tokens que ./native (colors.ts, typography.ts)
│   └── web.ts                            # NUEVO entry point, análogo a native.ts — export { Button, Card, ... }

apps/mobile/src/data/                     # se reemplaza por imports desde @repo/data-supabase;
                                           # SupabaseLoanRepository.ts / SupabaseClientRepository.ts / supabaseClient.ts
                                           # se eliminan de aquí (movidos, no duplicados)

supabase/migrations/
└── 0003_cartera_resumen.sql              # NUEVO — VIEW cartera_resumen (ver data-model.md)
```

**Structure Decision**: Monorepo Turborepo existente. Esta feature vive principalmente en `apps/web`, pero su prerequisito crítico (reutilizar sin duplicar la capa de datos de spec 001) obliga a extraer `packages/data-supabase` como paquete nuevo y a refactorar `apps/mobile/src/data/` para consumirlo — sin cambiar su comportamiento observable (los tests existentes de `apps/mobile` deben seguir pasando). `packages/core` se extiende (no se reescribe) con la superficie mínima que el dashboard y la tabla de préstamos activos necesitan. `packages/ui` gana su mitad web, ya anticipada por el comentario en `packages/ui/src/index.ts` desde la Fase 2.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Extraer `packages/data-supabase` desde `apps/mobile/src/data/` (paquete nuevo) en vez de que `apps/web` implemente sus propias clases | `apps/mobile` ya implementó `SupabaseLoanRepository`/`SupabaseClientRepository`, incluida la guarda de concurrencia crítica para FR-012/SC-006 de esta spec; duplicar ese código en `apps/web/src/data` arriesga que un bug corregido en una copia no se corrija en la otra, sobre código que mueve dinero | Duplicar los ~450 líneas en `apps/web/src/data` — rechazado: dos copias de la guarda de concurrencia pueden divergir silenciosamente; cualquier cambio de esquema futuro habría que aplicarlo dos veces |
| Añadir `@repo/ui/web` (nuevo entry point + primitivas DOM) en vez de estilizar `apps/web` con Tailwind suelto | `packages/ui/src/index.ts` ya dejó preparado el split web/native pero nunca implementó el lado web; sin esto, la paleta/tipografía de los mockups (`spec.md` raíz §9) se repetiría a mano en `apps/web`, con riesgo de divergir de lo que usa `apps/mobile` | Clases Tailwind sueltas con los valores de color hardcodeados en cada componente — rechazado: duplica los tokens ya centralizados en `packages/ui/src/tokens`, mismo riesgo de divergencia que motivó centralizar el motor financiero en `@repo/core` |
| Extender `ILoanRepository` (`listActive`) y añadir `IPortfolioReader` + `VIEW cartera_resumen` | Ninguna interfaz existente permite listar préstamos de todos los clientes a la vez ni leer un agregado de cartera; el dashboard (US1) y la tabla de préstamos activos (US2) no pueden construirse sin esto | Calcular los agregados en el navegador sumando todo `listActive()` — rechazado: obliga a traer toda la cartera al cliente para 4 números, y viola el patrón ya establecido (`cliente_score`) de que un agregado derivado se calcula en SQL, no repetido en cada pantalla |
