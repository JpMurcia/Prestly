---

description: "Task list template for feature implementation"
---

# Tasks: Automatización WhatsApp — Recordatorios, Comprobantes y Configuración de la API

**Input**: Design documents from `specs/004-whatsapp-automation/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Organization**: Tareas agrupadas por historia de usuario para implementar y verificar cada una de forma independiente.

## Phase 1: Setup

- [X] T001 Crear `supabase/migrations/0005_whatsapp_automation.sql` con `CREATE EXTENSION IF NOT EXISTS pg_cron;` y `CREATE EXTENSION IF NOT EXISTS pg_net;` (`supabase_vault` ya viene instalada — data-contract.md)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Lo que necesitan tanto la Historia 1 como la Historia 2 antes de poder implementarse. La Historia 3 NO depende de esta fase (es enteramente cliente, sin tabla ni RPC).

**⚠️ CRITICAL**: No se empieza la Historia 1 ni la Historia 2 sin completar esta fase.

- [X] T002 En `supabase/migrations/0005_whatsapp_automation.sql`, crear la tabla `notificaciones_whatsapp` con `UNIQUE (cuota_id, tipo)` (data-model.md) — depende de T001, mismo archivo, no paralelizable con T001/T003
- [X] T003 En `supabase/migrations/0005_whatsapp_automation.sql`, crear la función `estado_configuracion_whatsapp() RETURNS TABLE(conectado boolean, numero_desde text)` (`SECURITY DEFINER`, lee `vault.decrypted_secrets` — data-contract.md) — la usan tanto la función automática de la Historia 1 como la pantalla de la Historia 2; depende de T001, mismo archivo, no paralelizable con T001/T002
- [X] T004 [P] En `packages/core/src/interfaces/index.ts`, añadir los tipos (`WhatsAppNotificationType`, `WhatsAppNotificationResult`, `WhatsAppNotification`, `WhatsAppConfigStatus`) y las interfaces `IWhatsAppConfigRepository` / `IWhatsAppNotificationHistoryReader` (contracts/core-interfaces.md)

**Checkpoint**: Tabla, chequeo de conexión e interfaces listas — Historia 1 e Historia 2 pueden empezar.

---

## Phase 3: User Story 1 - Recibir recordatorios y alertas automáticas de cobro por WhatsApp (Priority: P1) 🎯 MVP

**Goal**: Un job diario detecta cuotas próximas a vencer o en mora y envía (o simula) un WhatsApp por cada una, sin intervención manual, con historial auditable.

**Independent Test**: `quickstart.md` Historia 1 — sembrar una cuota próxima a vencer y otra vencida, correr `revisar_y_enviar_notificaciones_whatsapp()` directamente y verificar los registros en `notificaciones_whatsapp`, sin depender de la Historia 2 (funciona en modo simulado) ni de la Historia 3.

- [X] T005 [US1] En `supabase/migrations/0005_whatsapp_automation.sql`, función `revisar_y_enviar_notificaciones_whatsapp() RETURNS TABLE(cuota_id uuid, tipo text, resultado text)` — selección de elegibles (data-model.md), normalización/validación de teléfono en SQL, llamada a `net.http_post`/`net.http_collect_response` cuando `estado_configuracion_whatsapp().conectado = true`, `estado = 'simulado'` si no, inserción idempotente `ON CONFLICT (cuota_id, tipo) DO NOTHING` (data-contract.md) — depende de T002/T003, mismo archivo, secuencial con T001-T003 y T006. Nota: los parámetros OUT se renombraron a `out_cuota_id`/`out_tipo`/`out_resultado` — `cuota_id`/`tipo` como OUT chocaban con la lista de columnas de `ON CONFLICT` (hallazgo real durante verificación, no anticipado en contracts/data-contract.md)
- [X] T006 [US1] En `supabase/migrations/0005_whatsapp_automation.sql`, registrar `cron.schedule('whatsapp-cobros-diario', '0 9 * * *', $$SELECT revisar_y_enviar_notificaciones_whatsapp();$$)` — depende de T005, mismo archivo
- [X] T007 [P] [US1] `packages/data-supabase/src/SupabaseWhatsAppNotificationHistoryReader.ts` implementando `IWhatsAppNotificationHistoryReader` (+ test en `packages/data-supabase/__tests__/`) — depende de T004
- [X] T008 [US1] `apps/web/src/hooks/useWhatsAppNotifications.ts` + panel de historial (tipo, resultado, fecha por cuota) integrado en una página existente de apps/web — depende de T007. Nota: se integró en `WhatsAppConfigPage.tsx` (T012), no en una página preexistente — más coherente tener ambas historias de WhatsApp en una sola pantalla que repartirlo en el Dashboard.
- [X] T009 [US1] Verificación real contra la base local reseteada: `quickstart.md` Historia 1, pasos 1-3 (modo simulado + idempotencia) — depende de T005/T006. Verificado con 3 clientes QA (recordatorio, mora, teléfono no normalizable) — 2 filas simuladas correctas, la 3ra correctamente omitida, 2da corrida sin filas nuevas.

**Checkpoint**: Historia 1 funcional y verificada en modo simulado (el modo real con Twilio se verifica en la Fase 6, cuando existan credenciales).

---

## Phase 4: User Story 2 - Configurar la conexión con la API de WhatsApp (Priority: P1)

**Goal**: El administrador puede guardar, ver el estado y borrar la conexión con Twilio desde `apps/web`.

**Independent Test**: `quickstart.md` Historia 2 — guardar credenciales de prueba, confirmar estado "conectado" sin ver la credencial completa, borrar y confirmar que vuelve a "no configurado"; no depende de la Historia 1 ni de la 3.

- [X] T010 [US2] En `supabase/migrations/0005_whatsapp_automation.sql`, funciones `guardar_configuracion_whatsapp(p_account_sid text, p_auth_token text, p_numero_desde text) RETURNS void` y `borrar_configuracion_whatsapp() RETURNS void` (ambas `SECURITY DEFINER`, data-contract.md) — depende de T003, mismo archivo, secuencial con las tareas anteriores de este archivo. Verificado: guardar → conectado=true con el número correcto → borrar → conectado=false otra vez.
- [X] T011 [P] [US2] `packages/data-supabase/src/SupabaseWhatsAppConfigRepository.ts` implementando `IWhatsAppConfigRepository` (+ test) — depende de T004
- [X] T012 [US2] `apps/web/src/hooks/useWhatsAppConfig.ts` + `apps/web/src/pages/WhatsAppConfigPage.tsx` (formulario, estado conectado/no conectado, acción de desconectar) + ruta nueva en `apps/web/src/router.tsx` — depende de T011
- [X] T013 [US2] Verificación real contra la base local reseteada: `quickstart.md` Historia 2 completa, incluyendo recarga de página tras guardar — depende de T010/T012. Verificado en navegador real (dev server con env vars de Supabase inyectadas por proceso, sin tocar `.env*` — ver nota en T021): guardar → "Conectado" con el número correcto → recarga de página → sigue "Conectado" → desconectar → vuelve a "No configurado".

**Checkpoint**: Historias 1 y 2 funcionales de forma independiente.

---

## Phase 5: User Story 3 - Compartir por WhatsApp con un toque (Priority: P2)

**Goal**: Botones de un solo toque para compartir la tabla de un préstamo recién emitido y el comprobante de un cobro recién registrado, sin depender de ninguna conexión configurada.

**Independent Test**: `quickstart.md` Historia 3 — emitir un préstamo y registrar un cobro, tocar cada botón y confirmar que abre `wa.me` con el mensaje correcto; funciona con la conexión de WhatsApp en estado "no configurado".

- [X] T014 [P] [US3] `packages/core/src/whatsapp/normalizePhone.ts` (`normalizePhoneForWhatsApp`) y `packages/core/src/whatsapp/buildShareLink.ts` (`buildWhatsAppShareLink`), con tests Jest primero (contracts/core-interfaces.md)
- [X] T015 [P] [US3] `packages/core/src/whatsapp/buildMessages.ts` (`buildLoanShareMessage`, `buildReceiptMessage`), con tests Jest primero. Nota: se ajustó el contrato para recibir montos/fechas ya formateados (`principalFormatted`, no `principal: number`) — evita un tercer formateador de moneda independiente de `formatMoney`/`formatCurrency` (contracts/core-interfaces.md actualizado).
- [X] T016 [US3] Botón "Compartir tabla por WhatsApp" tras emitir un préstamo — web y móvil, deshabilitado cuando `normalizePhoneForWhatsApp` devuelve `null` — depende de T014/T015. Web: `QuoteCalculatorPage.tsx` (estado post-emisión). Móvil: `LoanDetailScreen.tsx` — la app ya navega ahí justo tras emitir, es el punto real de "recién emitido" (no `QuoteCalculatorScreen.tsx`, que ya tenía un botón "Compartir" genérico de specs/001 sin destinatario, sin tocar).
- [X] T017 [US3] Botón "Enviar comprobante por WhatsApp" tras registrar un cobro — depende de T014/T015. Implementado como acción disponible en cualquier cuota 'paid'/'partial' (no solo la recién cobrada — más simple y más útil, permite reenviar un comprobante viejo) en `apps/web/src/pages/LoanAmortizationPage.tsx`, `apps/web/src/components/ClientDetailDrawer.tsx` y `apps/mobile/src/screens/LoanDetailScreen.tsx`.
- [X] T018 [US3] Verificación real en navegador (web) y revisión del flujo móvil: `quickstart.md` Historia 3, incluyendo el caso de teléfono no normalizable — depende de T016/T017. Web verificado en navegador real: emití un préstamo real → "Compartir tabla por WhatsApp" con `href` correcto (`wa.me/18095559911?text=...`, mensaje verificado carácter por carácter); registré un pago parcial y luego el resto → botón "WhatsApp" en `LoanAmortizationPage.tsx` con el mensaje correcto en ambos casos (parcial y pagada); cliente sin teléfono válido → botón con `aria-disabled="true"`, sin `href`, en `ClientDetailDrawer.tsx`. Móvil: sin simulador disponible en este entorno — verificado por type-check + mismo patrón ya probado en web (misma función `buildWhatsAppShareLink`/`buildReceiptMessage` de `@repo/core`).

**Checkpoint**: Las 3 historias funcionales de forma independiente.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T019 [US1] Verificación real con Twilio WhatsApp Sandbox (`quickstart.md` Historia 1, paso 4) — requiere las credenciales del usuario (Account SID, Auth Token, número de sandbox, número propio ya unido); si Twilio rechaza los parámetros por query string, aplicar el plan B de `research.md` §3 (body form-encoded como escalar de texto) y volver a probar. Solo se marca hecho cuando un WhatsApp real llega al número unido a la Sandbox.
- [X] T020 Actualizar `spec.md` raíz (Anexo — Relación con el roadmap del documento de negocio) marcando la Fase 5 como entregada, mismo estilo que las Fases 2-4. Nota honesta: "entregada, verificación real con Twilio pendiente" — no se reclama T019 como hecho.
- [X] T021 [P] Ejecutar `npm run type-check`, `npm run test` (`@repo/core`), `npm test --workspace=web` y la suite de `apps/mobile`; registrar el conteo real de tests en este archivo (no estimarlo). `type-check` limpio en los 5 paquetes (`@repo/core`, `@repo/data-supabase`, `@repo/ui`, `web`, `mobile`). Tests: 78 en total — 24 `@repo/core` + 26 `@repo/data-supabase` + 17 `web` + 11 `mobile` (subieron de 76 a 78 al arreglar dos mocks de `clientRepository` incompletos en `LoanAmortizationPage.test.tsx`/`QuoteCalculatorPage.test.tsx` que quedaron huérfanos tras T016/T017 — sin eso, las nuevas consultas de cliente fallaban en silencio sin hacer fallar ningún test). Verificación en navegador real: dev server de `apps/web` lanzado con `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` inyectadas por variables de entorno del proceso (`npm run dev -w apps/web`), no por un archivo `.env` — la regla de permisos de esta sesión sigue bloqueando leer/escribir cualquier `.env*` (igual que en specs/002-admin-web/ T006), así que la app real todavía no tiene ese archivo para uso fuera de esta sesión.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Fase 1)**: sin dependencias.
- **Foundational (Fase 2)**: depende de la Fase 1 — bloquea las Historias 1 y 2 (NO bloquea la Historia 3).
- **Historia 1 (Fase 3)** y **Historia 2 (Fase 4)**: dependen de la Fase 2; independientes entre sí.
- **Historia 3 (Fase 5)**: depende solo de la Fase 1 (no de la 2) — puede implementarse en paralelo a las Historias 1 y 2.
- **Polish (Fase 6)**: depende de las 3 historias completas (T019 específicamente de la Historia 1 + de que el usuario haya compartido credenciales reales de Twilio).

### Notas de archivo compartido

Todas las tareas que editan `supabase/migrations/0005_whatsapp_automation.sql` (T001, T002, T003, T005, T006, T010) son secuenciales entre sí pese a pertenecer a distintas fases/historias — un solo archivo, un solo autor a la vez.

## Implementation Strategy

### MVP primero (Historia 1)

1. Fase 1 (Setup) → Fase 2 (Foundational) → Fase 3 (Historia 1) → verificar con `quickstart.md` en modo simulado.
2. Historia 1 ya es un incremento demostrable (recordatorios/alertas automáticas, aunque simuladas) sin esperar a la 2 ni a la 3.

### Entrega incremental

1. Setup + Foundational.
2. Historia 1 (simulada) → demo.
3. Historia 2 → conectar Twilio real → volver a la Historia 1 para verificarla también en modo real (T019).
4. Historia 3 → demo — puede hacerse en cualquier momento después de la Fase 1, incluso antes que la 1/2 si conviene.
5. Polish (T020/T021) al final, con las 3 historias ya verificadas.
