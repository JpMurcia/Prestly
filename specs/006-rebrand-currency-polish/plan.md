# Implementation Plan: Marca Prestly, selector de moneda y cierre de brechas de mockup

**Branch**: `006-rebrand-currency-polish` | **Date**: 2026-09-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/006-rebrand-currency-polish/spec.md`

## Summary

Cuatro cambios independientes sobre el monorepo ya existente, sin proyectos nuevos: (1) moneda configurable (COP por defecto, USD/MXN seleccionables desde una nueva página "Configuración" en `apps/web`, consumida solo-lectura por `apps/mobile`) respaldada por una tabla singleton simple (sin Vault, no es un secreto); (2) renombrar la marca visible a "Prestly" en el sidebar web y el `app.json` de mobile; (3) un nuevo caso de uso puro `createStandaloneClient` en `@repo/core` que reutiliza la guarda anti-duplicado de teléfono ya existente en `issueLoan`, expuesto como botón "+ Nuevo"/"Nuevo cliente" en ambos directorios; y (4) cerrar los hallazgos de categoría "botón" pendientes y el contenido faltante de `specs/005-mockup-consistency-audit/REPORT.md` (KPIs y columnas extra en la tabla web, tarjeta "Cobrado" + progreso en el drawer, página nueva "Perfil completo" en web, barra de acciones inferior en el perfil móvil), todo sobre componentes y datos ya existentes. Cierra además creando `supabase/seed.sql` (referenciado en `config.toml`, inexistente hoy) con una cartera de ejemplo en pesos colombianos.

## Technical Context

**Language/Version**: TypeScript (apps/web, apps/mobile, @repo/core, packages/data-supabase, packages/ui) + SQL (migración Postgres)

**Primary Dependencies**: `@supabase/supabase-js` y `@tanstack/react-query` (ya en uso, sin dependencias nuevas); `Intl.NumberFormat` nativo para formato de moneda (sin librería de formato externa)

**Storage**: PostgreSQL/Supabase — tabla nueva `configuracion_app` (fila única, sin Vault: la moneda no es un secreto, mismo nivel de acceso que `clientes`/`prestamos`/`cuotas`, es decir sin RLS y sin funciones RPC intermediarias)

**Testing**: Jest (`@repo/core`: `createStandaloneClient`, `formatMoney`, metadata de monedas), Vitest (`apps/web`), Jest + React Native Testing Library (`apps/mobile`); verificación de punta a punta contra Postgres local recién reseteado (mismo estándar que fases 1-4)

**Target Platform**: Web (React 19 + Vite) y Mobile (Expo/React Native); backend Postgres/Supabase local vía Docker

**Project Type**: Web + mobile sobre el monorepo ya existente — solo archivos dentro de `apps/web`, `apps/mobile`, `packages/core`, `packages/data-supabase`, `packages/ui`, `supabase/migrations`, `supabase/seed.sql`

**Performance Goals**: Los ya vigentes de fases anteriores; el cambio de moneda debe reflejarse en la sesión activa de la web sin recargar manualmente (invalidación de React Query), no se requiere tiempo real entre dispositivos (Edge Cases de spec.md)

**Constraints**: Sin sistema de autenticación/usuarios (fuera de alcance, spec.md raíz) — la página "Perfil completo" y "Configuración" no dependen de saber quién es el administrador conectado

**Scale/Scope**: Single-tenant, cartera pequeña (igual que fases 1-4) — 6 historias de usuario, 1 tabla nueva, 1 caso de uso puro nuevo en `@repo/core`, ~14 archivos de UI modificados/nuevos entre las 2 apps, 1 archivo de datos semilla

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. SOLID estricto en @repo/core** — PASS. `createStandaloneClient` depende de `IClientReader`/`IClientWriter` (ya existentes, DIP), no de Supabase. La metadata de monedas y `formatMoney` se agregan a `@repo/core` como funciones/datos puros, sin dependencia de React ni de UI, para que web y mobile compartan exactamente el mismo formato (ISP no aplica aquí: no hay lectura/escritura separada porque la config de moneda es un valor único de solo-config, no una entidad con ciclo de vida propio).
- **II. Motor financiero único** — PASS. El formato de moneda no es un cálculo financiero (no toca `AmortizationCalculator` ni las estrategias de interés), pero se centraliza en `@repo/core` igualmente por la misma razón de fondo del principio: hoy `formatCurrency.ts` (web) y `money.ts` (mobile) ya duplican una función casi idéntica — esta fase corrige esa duplicación existente en vez de agregar una tercera variante.
- **III. Test-First para el motor financiero** — N/A para el motor de amortización (no se toca). `createStandaloneClient` y `formatMoney` son funciones puras nuevas de `@repo/core`: llevan test Jest antes de su implementación, mismo estándar de rigor que exige el principio para código de `packages/core`.
- **IV. Estado derivado sobre estado almacenado** — PASS. La moneda activa es una preferencia de configuración explícita (no derivable de otro dato), análoga a la configuración de WhatsApp que ya existe como estado almacenado legítimo — no es una excepción al principio, es la misma categoría de dato ("decisión explícita del administrador") que ya tiene precedente.
- **V. Simplicidad (YAGNI)** — PASS, con una decisión explícita: la configuración de moneda usa una tabla simple sin Vault ni RPC (a diferencia de WhatsApp) porque no es un secreto — replicar el patrón de Vault aquí sería complejidad sin justificación. Se descarta explícitamente sincronización en tiempo real entre dispositivos (Realtime/websockets) porque el spec no la exige (Edge Cases: alcanza con refrescar). Se descarta una librería de formato de moneda externa (`Intl` nativo alcanza).

Sin violaciones que requieran la tabla de Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/006-rebrand-currency-polish/
├── plan.md              # Este archivo
├── research.md          # Fase 0 — decisiones técnicas y su justificación
├── data-model.md        # Fase 1 — tabla configuracion_app, entidades de UI reutilizadas
├── contracts/
│   ├── core-interfaces.md # Fase 1 — tipos/interfaces/casos de uso de @repo/core
│   └── data-contract.md   # Fase 1 — esquema SQL, acceso desde supabase-js
├── quickstart.md          # Fase 1 — guía de verificación de punta a punta
└── tasks.md               # Fase 2 (/speckit-tasks — no generado por /speckit-plan)
```

### Source Code (repository root)

```text
supabase/
├── migrations/0006_configuracion_app.sql   # tabla singleton configuracion_app + fila inicial 'COP'
└── seed.sql                                 # NUEVO — cartera de ejemplo en pesos colombianos

packages/core/src/
├── interfaces/index.ts                # + IAppSettingsRepository, tipos CurrencyCode/Client sin cambios
├── domain/currency.ts                  # NUEVO — metadata de monedas (COP/USD/MXN) + formatMoney()
└── use-cases/
    ├── createStandaloneClient.ts       # NUEVO — alta de cliente sin préstamo, guarda anti-duplicado
    └── issueLoan.ts                    # sin cambios de lógica; ver research.md §3 sobre reutilización

packages/data-supabase/src/
└── SupabaseAppSettingsRepository.ts    # NUEVO — select/update directo sobre configuracion_app (sin RPC)

packages/ui/src/primitives{,-web}/
└── SegmentedControl.tsx                # NUEVO primitivo compartido — toggle resumen/tabla (mobile) y otros usos futuros

apps/web/src/
├── layout/AppShell.tsx                 # "Microcréditos" → "Prestly"; ítem de sidebar "WhatsApp" → "Configuración"
├── pages/
│   ├── WhatsAppConfigPage.tsx          # se renombra/reubica su contenido dentro de SettingsPage.tsx
│   ├── SettingsPage.tsx                # NUEVO — tarjeta "Moneda" + tarjeta "Conexión con Twilio" (contenido movido)
│   ├── ClientProfilePage.tsx           # NUEVO — "Perfil completo" (Historia 5)
│   ├── ClientDirectoryPage.tsx         # KPIs, columnas extra, pie de tabla, botón "Nuevo cliente"
│   ├── LoanAmortizationPage.tsx        # conteo en FilterTab, columna "Saldo restante"
│   └── DashboardPage.tsx               # sin cambios de contenido (ya cubierto por 005 fuera de alcance aquí)
├── components/
│   ├── ClientDetailDrawer.tsx          # tarjeta "Cobrado" + barra de progreso + botón "Perfil completo"
│   └── NewClientModal.tsx              # NUEVO — compartido por directorio y (opcionalmente) drawer
├── hooks/
│   ├── useAppSettings.ts               # NUEVO — lee/actualiza moneda (React Query)
│   └── useCreateClient.ts              # NUEVO
├── lib/formatCurrency.ts               # pasa a delegar en packages/core/src/domain/currency.ts
└── router.tsx                          # + ruta /clientes/:id (Perfil completo), /configuracion reemplaza /whatsapp

apps/mobile/
├── app.json                            # expo.name → "Prestly"
├── src/screens/
│   ├── QuoteCalculatorScreen.tsx        # botón "Compartir tabla por WhatsApp" con ícono, SegmentedControl
│   ├── ClientDirectoryScreen.tsx        # botón "+ Nuevo"
│   ├── ClientProfileScreen.tsx          # notas solo-lectura + "Editar", barra de acciones inferior
│   └── CollectionRouteScreen.tsx        # botón de acción cuadrado-redondeado (10px)
├── src/components/
│   └── NewClientModal.tsx               # NUEVO — misma UX que web, adaptado a React Native
├── src/hooks/
│   ├── useAppSettings.ts                # NUEVO — solo lectura
│   └── useCreateClient.ts               # NUEVO
└── src/utils/money.ts                   # pasa a delegar en packages/core/src/domain/currency.ts
```

**Structure Decision**: Se extiende el monorepo ya existente, sin proyectos nuevos. La configuración de moneda vive solo en `apps/web` (igual división que WhatsApp en `specs/004-whatsapp-automation/`) — `apps/mobile` solo consume el valor. El alta de cliente sin préstamo y el formato de moneda sí se implementan en ambas apps porque ambas muestran dinero y ambas necesitan el botón "+ Nuevo"/"Nuevo cliente" (spec FR-006). `NewClientModal` se duplica una vez por plataforma (mismo criterio ya usado en todo el proyecto: `primitives/` vs `primitives-web/` en `packages/ui`) en vez de forzar un componente cross-platform.

## Complexity Tracking

*Sin violaciones a la constitución — tabla omitida.*
