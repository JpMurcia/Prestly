# Implementation Plan: Flexibilidad de Pago Avanzada — Meses de Gracia, Abonos a Capital y Paz y Salvo

**Branch**: `008-flexible-repayment-features` | **Date**: 2026-09-14 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/008-flexible-repayment-features/spec.md`

## Summary

Tres extensiones al motor financiero ya existente, construidas sin tocar `AmortizationCalculator` ni `FlatRateFixedInstallmentStrategy` (OCP, constitución Principio I): (1) **Meses de gracia** — un nuevo paso puro `applyGracePeriods` que se compone DESPUÉS de `quoteLoan`, desplazando el capital+interés ya fijado de las cuotas marcadas hacia la cuota siguiente; las cuotas de gracia se emiten directamente `pagado`/`$0` (no requieren tocar mora, `cliente_score` sí necesita excluirlas de su denominador). (2) **Abonos a capital** — `registrar_cobro` se extiende (mismo procedimiento, misma firma) para que un monto que excede lo exigible de la cuota ya no se rechace (`MONTO_INVALIDO`): cubre la cuota actual y aplica el excedente según `configuracion_app.modo_abono_capital` — `reducir_plazo` (default) prepaga cuotas futuras completas en orden; `reducir_cuota` reduce el capital restante de las cuotas futuras (nunca su interés, ya fijado — decisión confirmada: los abonos NUNCA condonan interés). (3) **Paz y Salvo** — función pura nueva `buildPayoffCertificate`, sin tabla nueva (se genera bajo demanda), reutilizando el patrón ya existente de `buildMessages.ts`/`buildShareLink.ts` para compartir por WhatsApp.

## Technical Context

**Language/Version**: TypeScript estricto (apps/web, apps/mobile, `@repo/core`, `packages/data-supabase`, `packages/ui`) + SQL (PL/pgSQL, Postgres vía Supabase CLI local)

**Primary Dependencies**: Ninguna dependencia nueva — `@supabase/supabase-js` y `@tanstack/react-query` (ya en uso), React 19/Vite/TailwindCSS 4 (web), Expo/React Native/NativeWind (mobile)

**Storage**: PostgreSQL/Supabase. Extiende 3 tablas ya existentes (`cuotas` + `es_gracia`, `cobros` + `abono_capital`, `configuracion_app` + `modo_abono_capital`) y modifica 3 objetos ya existentes con la MISMA firma (`emitir_prestamo`, `registrar_cobro`, `VIEW cliente_score`) — no se crea ninguna función ni tabla nueva, así que los `GRANT`/`REVOKE` de RLS ya vigentes desde `specs/007-admin-authentication/` (`0007_auth_rls.sql`) siguen aplicando sin cambios (evita repetir el hallazgo de seguridad de spec 007 T028 sobre `EXECUTE ... FROM PUBLIC`).

**Testing**: Jest (`@repo/core`: TDD para `applyGracePeriods`, `splitPaymentForInstallment`, `buildPayoffCertificate` — el caso de referencia $500/15%/12 semanal de la constitución no puede dejar de pasar), Jest (`packages/data-supabase`, mismo patrón que `SupabaseAuthRepository.test.ts`), Vitest (`apps/web`), Jest + React Native Testing Library (`apps/mobile`); verificación de punta a punta contra Postgres local recién reseteado, incluida prueba directa por `curl` de `registrar_cobro` con un monto excedente sin sesión (debe seguir rechazando con 401 — mismo estándar que spec 007 T028).

**Target Platform**: Web (`http://localhost:5300`) y Mobile (Expo, incl. modo web) — ambas ya autenticadas (spec 007).

**Project Type**: Monorepo ya existente — sin proyectos nuevos. Cambios dentro de `packages/core`, `packages/data-supabase`, `apps/web`, `apps/mobile`, `supabase/migrations`.

**Performance Goals**: Los ya vigentes — cotización (incluida la vista previa de gracia) sigue siendo síncrona/local en `@repo/core`, sin red; el registro de un cobro con abono a capital sigue siendo una sola llamada RPC atómica (mismo patrón que `registrar_cobro`/`liquidar_prestamo` ya existentes), sin N llamadas desde el cliente.

**Constraints**: No se modifica `AmortizationCalculator.ts` ni `FlatRateFixedInstallmentStrategy.ts` (constitución Principio I, OCP). Debe preservarse la regla de conciliación §5.3 de `spec.md` raíz (la suma de `monto_capital` de todas las cuotas de un préstamo sigue siendo exactamente `prestamos.capital`) en los tres escenarios nuevos: gracia, abono a capital en ambos modos, y el estado final de un préstamo saldado. Los abonos a capital NUNCA condonan interés (decisión confirmada en `spec.md` de esta feature, FR-008) — implica que, en modo `reducir_cuota`, una cuota futura puede llegar a ser "solo interés" si el abono ya cubrió todo el capital restante; se documenta como consecuencia esperada, no como bug (research.md D5).

**Scale/Scope**: Mismo alcance single-tenant de siempre. 3 historias de usuario, 1 migración nueva (`0008_flexible_repayment.sql`, sin funciones/tablas nuevas), ~4 archivos nuevos en `@repo/core` + `interfaces/index.ts` extendido, 2 repositorios de `packages/data-supabase` extendidos, UI nueva/modificada en ambas apps (selector de gracia en la cotización, badge de abono a capital reemplazando el bloque de "cambio a entregar" en el modal de cobro, selector de modo en Configuración, botón+vista de certificado en el detalle de préstamo).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. SOLID estricto en @repo/core** — **PASS**. `applyGracePeriods` y `splitPaymentForInstallment` son funciones puras nuevas que COMPONEN sobre `quoteLoan`/`AmortizationCalculator` sin modificarlos (mismo patrón OCP ya previsto en `spec.md` raíz §5.2 para nuevas estrategias). `buildPayoffCertificate` sigue el patrón SRP ya establecido por `buildLoanShareMessage`/`buildReceiptMessage` (redacta, no persiste, no calcula moneda). `IAppSettingsRepository` gana un método (`updatePrincipalContributionMode`) en la misma interfaz ya no separada ISP-style que `updateCurrency` — mismo criterio ya documentado ahí (un único consumidor real, la pantalla de Configuración).
- **II. Motor financiero único** — **PASS**. Las 3 fórmulas nuevas (acumulación de gracia, reparto de abono a capital en sus 2 modos, validación de saldo $0.00) viven únicamente en `@repo/core`; `apps/web` y `apps/mobile` las consumen igual, sin reimplementarlas — mismo criterio ya aplicado a pagos parciales/liquidación anticipada en `specs/003-operational-management/` FR-011.
- **III. Test-First para el motor financiero** — **PASS**, TDD explícito: tests Jest para `applyGracePeriods` (2 meses de gracia no consecutivos, ver quickstart.md), `splitPaymentForInstallment` (con y sin excedente), y `buildPayoffCertificate` (saldo $0.00 exacto vs. no exacto), escritos antes de la implementación — mismo estándar que el caso de referencia $500/15%/12 semanal, que sigue pasando sin cambios (ninguna de las 3 funciones nuevas lo toca).
- **IV. Estado derivado sobre estado almacenado** — **PASS**, con una decisión explícita: `cuotas.es_gracia` y `cobros.abono_capital` son HECHOS almacenados legítimos (decisiones explícitas del administrador al estructurar el préstamo o al cobrar — misma categoría que `configuracion_app.moneda`, ya con precedente en `specs/006-rebrand-currency-polish/`), no estados derivados que deban recalcularse. El saldo $0.00 que habilita el Certificado de Paz y Salvo SIGUE siendo derivado (`remainingBalance`, ya existente) — el certificado no se persiste (`spec.md` Assumptions), se construye en el momento a partir de ese derivado.
- **V. Simplicidad (YAGNI)** — **PASS**, con 2 decisiones explícitas: (a) el modo de recálculo es una sola columna de instalación (`configuracion_app.modo_abono_capital`), sin UI de elección por transacción — ya resuelto en la spec (FR-007); (b) ninguna función ni tabla nueva en SQL — se extienden las 3 ya existentes (`emitir_prestamo`, `registrar_cobro`, `cliente_score`) con la misma firma, evitando duplicar guardas de concurrencia/RLS que ya existen.

Sin violaciones que requieran la tabla de Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/008-flexible-repayment-features/
├── plan.md              # Este archivo
├── research.md          # Fase 0 — decisiones técnicas (D1-D9) y su justificación
├── data-model.md        # Fase 1 — columnas nuevas, migración 0008 completa
├── contracts/
│   ├── core-interfaces.md # Fase 1 — tipos/funciones/errores nuevos de @repo/core
│   └── data-contract.md   # Fase 1 — contrato SQL (emitir_prestamo, registrar_cobro, cliente_score)
├── quickstart.md          # Fase 1 — guía de verificación de punta a punta por historia
└── tasks.md               # Fase 2 (/speckit-tasks — no generado por /speckit-plan)
```

### Source Code (repository root)

```text
supabase/migrations/
└── 0008_flexible_repayment.sql       # NUEVO — 3 ALTER TABLE + 3 CREATE OR REPLACE (mismas firmas)

packages/core/src/
├── interfaces/index.ts                # + isGrace en LoanInstallment/NewLoan; GracedInstallment(Schedule);
│                                       #   PrincipalContributionMode; PaymentSplit; RegisterInstallmentPaymentResult;
│                                       #   AppSettings.principalContributionMode; IAppSettingsRepository
│                                       #   .updatePrincipalContributionMode; PayoffCertificateData
├── domain/
│   ├── graceInstallments.ts           # NUEVO — applyGracePeriods, LastInstallmentCannotBeGraceError
│   └── principalContribution.ts       # NUEVO — splitPaymentForInstallment
├── payoff/
│   └── buildPayoffCertificate.ts      # NUEVO — buildPayoffCertificate, LoanNotFullySettledError
├── whatsapp/buildMessages.ts          # + buildPayoffCertificateMessage (mismo archivo, mismo patrón)
└── index.ts                           # + exports nuevos

packages/data-supabase/src/
├── SupabaseLoanRepository.ts          # registerInstallmentPayment devuelve RegisterInstallmentPaymentResult;
│                                       #   save() envía es_gracia por cuota a emitir_prestamo
└── SupabaseAppSettingsRepository.ts   # + updatePrincipalContributionMode; getSettings lee modo_abono_capital

apps/web/src/
├── pages/
│   ├── QuoteCalculatorPage.tsx         # + sección opcional "Configurar meses de gracia" (checkbox por cuota)
│   ├── LoanAmortizationPage.tsx        # + badge "Gracia" por fila; bloque "cambio a entregar" →
│   │                                   #   badge "Excedente de $X irá a Abono a Capital"; botón
│   │                                   #   "Generar Paz y Salvo" cuando saldo=$0.00 (reemplaza "Cobrar"/"Liquidar")
│   └── SettingsPage.tsx                # + selector "Modo de abono a capital" (reducir plazo / reducir cuota)
├── components/
│   └── PayoffCertificateView.tsx       # NUEVO — vista imprimible/compartible del certificado
└── hooks/useAppSettings.ts             # + mutación de modo de abono a capital

apps/mobile/src/
├── screens/
│   ├── QuoteCalculatorScreen.tsx       # + selector de meses de gracia (mismo criterio que web)
│   └── LoanDetailScreen.tsx            # + botón "Generar Paz y Salvo" cuando saldo=$0.00
├── components/
│   ├── RegisterPaymentModal.tsx        # bloque "Cambio a entregar" → badge de abono a capital
│   └── PayoffCertificateView.tsx       # NUEVO — adaptado React Native (mismo dato, misma fuente)
└── hooks/useRegisterPayment.ts         # ajustado al nuevo RegisterInstallmentPaymentResult
```

**Structure Decision**: Se extiende el monorepo ya existente, sin proyectos nuevos. La UI de las 3 historias se construye en ambas apps (igual criterio que `specs/003-operational-management/`: cobro y liquidación ya viven en ambas plataformas) porque el prestamista cobra y estructura préstamos indistintamente desde campo (móvil) o desde el centro de control (web). El selector de modo de abono a capital vive solo en `apps/web/SettingsPage.tsx` (mismo patrón que moneda/WhatsApp — `apps/mobile` solo lo consume vía `getSettings()`, no lo modifica). `PayoffCertificateView` se duplica una vez por plataforma (mismo criterio ya usado en todo el proyecto para vistas con layout específico de cada UI kit) en vez de forzar un componente cross-platform — ambas consumen el mismo `PayoffCertificateData` de `@repo/core`.

## Complexity Tracking

*Sin violaciones a la constitución — tabla omitida.*
