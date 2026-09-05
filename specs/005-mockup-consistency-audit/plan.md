# Implementation Plan: Auditoría de Consistencia con el Mockup Inicial

**Branch**: `005-mockup-consistency-audit` | **Date**: 2026-09-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-mockup-consistency-audit/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Producir una auditoría visual documentada que compare las 8 pantallas del mockup inicial (`Docs/Plataforma Mockus/Microcreditos - Mockups.dc.html`) contra su implementación real en `apps/mobile` (6 pantallas) y `apps/web` (2 pantallas), verificando colores, tipografía, layout y botones. El resultado es un único reporte Markdown consolidado (`REPORT.md`) con un veredicto por pantalla, hallazgos categorizados y priorizados por severidad, y una sección explícita para pantallas/funcionalidades sin mockup de referencia (partial payments, early payoff, portfolio trend, WhatsApp automation). No se modifica código de la aplicación en este alcance — solo se documenta.

## Technical Context

**Language/Version**: N/A para nuevo código — se leen fuentes existentes en TypeScript/TSX (`apps/web`, `apps/mobile`, `packages/ui`) y el mockup estático (HTML/CSS embebido en `.dc.html`)

**Primary Dependencies**: Ninguna dependencia nueva. Se usan como fuente de verdad auxiliar los tokens ya existentes en `packages/ui/src/tokens/colors.ts` y `packages/ui/src/tokens/typography.ts`, y el componente compartido `packages/ui/src/primitives{,-web}/Button.tsx`

**Storage**: N/A — el único artefacto persistente es el reporte Markdown en `specs/005-mockup-consistency-audit/`

**Testing**: N/A — auditoría manual/visual, no se agregan tests automatizados; la "prueba" es la revisión cruzada descrita en SC-004

**Target Platform**: Se renderizan ambas apps solo para inspección visual — `apps/web` vía Vite dev server (puerto 5300) y `apps/mobile` vía Expo (simulador/dispositivo) — pero no se despliega ni modifica nada

**Project Type**: Auditoría/documentación transversal a un monorepo web + mobile ya existente (no es una app ni servicio nuevo)

**Performance Goals**: N/A

**Constraints**: FR-008 — la auditoría MUST NOT modificar código de la aplicación; SC-001 — debe cubrir el 100% de las 8 pantallas del mockup inicial

**Scale/Scope**: 8 artboards del mockup inicial (1a, 1b, 1c, 2a, 2b, 2c, 2d, 2e) mapeados a 5 pantallas + 2 componentes de `apps/mobile` y 4 pantallas/componentes de `apps/web`; 1 componente compartido (`Button`) auditado una sola vez por FR-003/edge case de componentes compartidos

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

La constitución de Prestly rige específicamente `packages/core` (motor financiero SOLID) y no aplica en la mayoría de sus principios a esta auditoría, que no toca `packages/core` ni datos ni cálculos financieros:

- **I. SOLID estricto en `@repo/core`**: N/A — esta auditoría no modifica `packages/core`.
- **II. Motor financiero único**: N/A — no hay cambios de lógica de cálculo.
- **III. Test-First para el motor financiero**: N/A — no hay cambios en `packages/core`.
- **IV. Estado derivado sobre estado almacenado**: N/A — la auditoría no introduce persistencia nueva; el reporte es un documento, no una tabla.
- **V. Simplicidad (YAGNI)**: ✅ Cumple — el alcance se limita a documentar lo que el mockup ya definió (FR-001), sin construir herramientas de diffing automatizado ni anticipar mockups futuros para pantallas de fases posteriores (edge case: se marcan como "sin referencia", no se inventa un mockup).
- **Flujo de trabajo** (`spec.md` raíz como fuente de verdad del producto): ✅ Cumple — esta auditoría no cambia alcance ni modelo de datos del producto, por lo que no requiere actualizar `spec.md` raíz; solo si el reporte revela que una decisión visual documentada allí quedó desactualizada, eso se maneja como seguimiento aparte.

**Resultado**: PASS. No hay violaciones que justificar en Complexity Tracking.

**Re-chequeo post-diseño (Phase 1)**: Los artefactos de diseño (`data-model.md`, `contracts/audit-report-format.md`, `quickstart.md`) confirman que el único artefacto nuevo es documentación bajo `specs/005-mockup-consistency-audit/`; no se introdujo ninguna tabla, servicio ni cambio a `packages/core`. El gate sigue en **PASS**.

## Project Structure

### Documentation (this feature)

```text
specs/005-mockup-consistency-audit/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/
│   └── audit-report-format.md   # Estructura obligatoria del REPORT.md (Phase 1 output)
├── REPORT.md            # Entregable de la auditoría (se llena en /speckit-implement, no aquí)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

No se crea código nuevo. La auditoría lee (sin modificar) las siguientes rutas ya existentes del monorepo:

```text
Docs/Plataforma Mockus/
└── Microcreditos - Mockups.dc.html   # Mockup inicial: 8 artboards (fuente de verdad visual)

apps/mobile/src/
├── screens/
│   ├── QuoteCalculatorScreen.tsx      # ↔ artboards 1a, 2a
│   ├── LoanDetailScreen.tsx           # ↔ artboard 1b (detalle de préstamo + cronograma)
│   ├── ClientDirectoryScreen.tsx      # ↔ artboard 2b
│   ├── ClientProfileScreen.tsx        # ↔ artboard 2c (score + notas + historial)
│   └── CollectionRouteScreen.tsx      # ↔ artboard 2d
└── components/
    ├── RegisterPaymentModal.tsx       # ↔ artboard 1b (registro de pago)
    └── IssueLoanSheet.tsx             # sin artboard propio — ver "sin referencia"

apps/web/src/
├── pages/
│   ├── DashboardPage.tsx              # ↔ artboard 1c
│   ├── LoanAmortizationPage.tsx       # ↔ artboard 1c (tabla de amortización extendida)
│   ├── ClientDirectoryPage.tsx        # ↔ artboard 2e
│   ├── QuoteCalculatorPage.tsx        # sin artboard propio (mockup solo cotiza en móvil)
│   ├── ActiveLoansPage.tsx            # sin artboard propio (spec 003)
│   └── WhatsAppConfigPage.tsx         # sin artboard propio (spec 004)
└── components/
    └── ClientDetailDrawer.tsx         # ↔ artboard 2e (drawer de amortización)

packages/ui/src/
├── tokens/{colors.ts,typography.ts}   # Fuente de verdad auxiliar en código para color/tipografía
└── primitives{,-web}/{Button.tsx,Card.tsx}   # Componentes compartidos — se auditan una vez, no por pantalla
```

**Structure Decision**: No aplica ninguna de las opciones de estructura de código nueva (single project / web app / mobile+API) porque esta feature no añade una aplicación ni un servicio: es una auditoría de las apps `apps/web` y `apps/mobile` ya existentes en el monorepo Turborepo descrito en la constitución. El único artefacto nuevo es documentación bajo `specs/005-mockup-consistency-audit/`, incluyendo el entregable final `REPORT.md`.

## Complexity Tracking

*No aplica — el Constitution Check no reportó violaciones (ver sección anterior). Esta tabla queda vacía intencionalmente.*
