# Implementation Plan: Automatización WhatsApp — Recordatorios, Comprobantes y Configuración de la API

**Branch**: `004-whatsapp-automation` | **Date**: 2026-09-03 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/004-whatsapp-automation/spec.md`

## Summary

Cierra la Fase 5 del roadmap de negocio: (1) un job diario (`pg_cron` + `pg_net`, sin intervención manual) que detecta cuotas próximas a vencer o en mora y envía — o simula, según haya conexión configurada — un WhatsApp por cada una, con historial auditable; (2) una pantalla en `apps/web` para conectar/desconectar Twilio WhatsApp Sandbox, con las credenciales guardadas en Supabase Vault (nunca expuestas al cliente); (3) dos botones de un solo toque (mobile y web) para compartir la tabla de amortización y el comprobante de cobro por `wa.me`, sin depender de ninguna conexión configurada. El envío real se verifica en vivo contra Twilio WhatsApp Sandbox antes de dar la fase por entregada.

## Technical Context

**Language/Version**: TypeScript (apps/web, apps/mobile, @repo/core, packages/data-supabase) + PL/pgSQL (funciones Postgres, mismo patrón que `registrar_cobro`)

**Primary Dependencies**: `@supabase/supabase-js` (ya en uso); extensiones Postgres `pg_cron` 1.6.4 y `pg_net` 0.20.4 (confirmadas disponibles en la imagen local, no instaladas hasta esta migración) y `supabase_vault` 0.3.1 (ya instalada); API REST de Twilio llamada directamente por HTTP vía `pg_net` — sin SDK de Twilio, sin Edge Functions (research.md §1)

**Storage**: PostgreSQL/Supabase — tabla nueva `notificaciones_whatsapp`; credenciales de Twilio en Supabase Vault (no en una tabla de `public`)

**Testing**: Jest (`@repo/core`), Vitest (`apps/web`), Jest + React Native Testing Library (`apps/mobile`); verificación real contra el Postgres local (`docker exec supabase_db_Prestly psql`, scripts Node desechables) y contra Twilio WhatsApp Sandbox real — mismo estándar de las fases 1-4 (`quickstart.md`)

**Target Platform**: Web (React 19 + Vite) y Mobile (Expo/React Native); backend Postgres/Supabase local vía Docker

**Project Type**: Web + mobile sobre el monorepo ya existente — no se añaden proyectos nuevos, solo archivos dentro de `apps/web`, `apps/mobile`, `packages/core`, `packages/data-supabase`, `supabase/migrations`

**Performance Goals**: Los ya vigentes de fases anteriores (dashboard <5s, acciones de un toque sin demora perceptible — SC-002/SC-003 de esta spec); esta fase no añade una ruta de alto volumen

**Constraints**: Sin credenciales de Meta API (fuera de alcance, spec.md); `pg_net` es asíncrono — la función de envío debe esperar la respuesta real (`net.http_collect_response(..., async := false)`) antes de decidir `'enviado'` vs `'fallido'` (research.md §3, con una verificación empírica pendiente de si Twilio acepta parámetros por query string en el POST)

**Scale/Scope**: Single-tenant, cartera pequeña (igual que fases 1-4) — sin colas, reintentos ni rate-limiting; 3 historias de usuario, 1 tabla nueva, 4 funciones RPC, 1 job de `pg_cron`, 4 funciones puras + 2 interfaces nuevas en `@repo/core`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. SOLID estricto en @repo/core** — PASS. `IWhatsAppConfigRepository` e `IWhatsAppNotificationHistoryReader` (contracts/core-interfaces.md) siguen DIP igual que `ILoanRepository`. Se mantienen separadas (ISP) porque el historial ya tiene un consumidor potencial distinto de la pantalla de configuración (ej. futuro historial por cliente); dentro de `IWhatsAppConfigRepository` NO se separó lectura de escritura en dos interfaces — a diferencia de `IClientReader`/`IClientWriter`, hoy existe un único consumidor real (la pantalla de configuración) que siempre necesita ambas mitades juntas, así que separarlas sería una abstracción sin un segundo consumidor que la justifique (YAGNI).
- **II. Motor financiero único** — N/A (no aplica). Esta fase no calcula interés ni amortización. La elegibilidad de "próxima a vencer"/"en mora" reutiliza la misma semántica de `fecha_vencimiento`/`estado` que ya usan `cliente_score`/`idx_cuotas_pendientes` (FR-011) — no es una fórmula financiera nueva.
- **III. Test-First para el motor financiero** — N/A para el motor existente (no se toca `AmortizationCalculator` ni las estrategias de interés). Las funciones puras nuevas de `@repo/core` (normalización de teléfono, construcción de enlace/mensajes) sí llevan test Jest antes de su implementación, mismo estándar de rigor.
- **IV. Estado derivado sobre estado almacenado** — PASS, con una excepción justificada: `notificaciones_whatsapp` es estado *almacenado* deliberadamente, porque es un hecho histórico ("se envió/simuló/falló en este momento"), no un valor derivable de otros datos — igual que `cobros` ya lo es. La elegibilidad en sí (quién necesita notificación hoy) sigue siendo 100% derivada, nunca cacheada.
- **V. Simplicidad (YAGNI)** — PASS. Esta es la fase en la que WhatsApp "llega" según el roadmap (spec.md raíz, Anexo), así que empieza a construirse ahora y no antes. Se descartó explícitamente introducir Edge Functions, un segundo proveedor (Meta), o infraestructura de reintentos/colas — research.md documenta cada decisión de no construir de más.

Sin violaciones que requieran la tabla de Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/004-whatsapp-automation/
├── plan.md              # Este archivo
├── research.md           # Fase 0 — decisiones técnicas y su justificación
├── data-model.md          # Fase 1 — tabla nueva, Vault, regla de normalización de teléfono
├── contracts/
│   ├── core-interfaces.md # Fase 1 — tipos/interfaces/funciones puras de @repo/core
│   └── data-contract.md   # Fase 1 — funciones RPC, job de pg_cron, extensiones
├── quickstart.md          # Fase 1 — guía de verificación de punta a punta
└── tasks.md               # Fase 2 (/speckit-tasks — no generado por /speckit-plan)
```

### Source Code (repository root)

```text
supabase/migrations/
└── 0005_whatsapp_automation.sql   # extensiones, tabla notificaciones_whatsapp, funciones RPC, job de pg_cron

packages/core/src/
├── interfaces/index.ts             # + IWhatsAppConfigRepository, IWhatsAppNotificationHistoryReader, tipos
└── whatsapp/
    ├── normalizePhone.ts           # + tests en packages/core/__tests__/whatsapp/
    ├── buildShareLink.ts
    └── buildMessages.ts            # buildLoanShareMessage, buildReceiptMessage

packages/data-supabase/src/
├── SupabaseWhatsAppConfigRepository.ts        # + tests
└── SupabaseWhatsAppNotificationHistoryReader.ts # + tests

apps/web/src/
├── pages/WhatsAppConfigPage.tsx     # Historia 2
├── components/                      # panel de historial (Historia 1) + botones de compartir (Historia 3)
├── hooks/useWhatsAppConfig.ts, useWhatsAppNotifications.ts
└── router.tsx                       # nueva ruta de configuración

apps/mobile/src/
├── components/ o screens/           # botones de compartir (Historia 3) — sin pantalla de configuración ni historial
```

**Structure Decision**: Se extiende el monorepo ya existente, sin proyectos nuevos. La configuración y el historial (Historia 1 parcial, Historia 2) viven solo en `apps/web` — `apps/mobile` solo gana los botones de compartir de la Historia 3, consistente con que el mockup dibuja "Compartir tabla"/"Enviar comprobante" en las pantallas de campo (móvil) y la configuración es una tarea de escritorio/administración (igual división que ya existe entre el dashboard de tendencia — solo web — y el registro de cobros — ambas apps — en `specs/003-operational-management/`).
