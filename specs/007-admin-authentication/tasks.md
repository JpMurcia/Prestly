---

description: "Task list template for feature implementation"
---

# Tasks: Autenticación del administrador (Supabase Auth)

**Input**: Design documents from `specs/007-admin-authentication/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: Se incluye test para `SupabaseAuthRepository` (Principio III de la constitución aplicado con el mismo rigor que a `packages/core` — es el único código nuevo con lógica real: mapeo de errores) y tests de la guarda de acceso en cada app (`RequireAuth`/`RootNavigator` — plan.md, Technical Context). No se generan tests nuevos para pantallas ya cubiertas por specs anteriores.

**Organization**: Tareas agrupadas por historia de usuario (spec.md) para implementar y verificar cada una de forma independiente.

## Phase 1: Setup (base de datos y configuración)

- [X] T001 Habilitar Auth localmente y cerrar el auto-registro público en `supabase/config.toml`: `[auth] enabled = true` (era `false`), `enable_signup = false` (era `true`) — research.md §1-§2, contracts/data-contract.md
- [X] T002 Crear `supabase/migrations/0007_auth_rls.sql`: `CREATE EXTENSION IF NOT EXISTS pgcrypto;`, `ENABLE ROW LEVEL SECURITY` + policy `FOR ALL TO authenticated USING (true) WITH CHECK (true)` en `clientes`, `prestamos`, `cuotas`, `cobros`, `configuracion_app`, `notificaciones_whatsapp`; `ALTER VIEW ... SET (security_invoker = true)` en `cliente_score`, `cartera_resumen`, `cartera_tendencia_mensual`; `REVOKE EXECUTE ... FROM anon` en `emitir_prestamo`, `registrar_cobro(UUID, NUMERIC)`, `liquidar_prestamo`, `estado_configuracion_whatsapp`, `guardar_configuracion_whatsapp`, `borrar_configuracion_whatsapp` (firmas exactas en contracts/data-contract.md) — data-model.md
- [X] T003 Agregar la cuenta administradora de desarrollo a `supabase/seed.sql`: insert en `auth.users` + `auth.identities` para `admin@prestly.local` usando `crypt()`/`gen_salt('bf')` (research.md §7, contracts/data-contract.md) — depende de T002 (necesita `pgcrypto`)

**Checkpoint**: `npx supabase db reset` deja la base con Auth activo, RLS cerrada, y la cuenta de desarrollo lista.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Contrato de autenticación compartido por ambas apps — ninguna historia de usuario empieza su UI sin esto.

**⚠️ CRITICAL**: Ninguna historia de usuario empieza su UI sin esta fase completa.

- [X] T004 [P] En `packages/core/src/interfaces/index.ts`, agregar `AuthSession` e `IAuthRepository` (contracts/core-interfaces.md) — sin dependencias
- [X] T005 [P] En `packages/data-supabase/src/createSupabaseClient.ts`, agregar tercer parámetro opcional `{ authStorage }`; cambiar `persistSession` a `true` y agregar `autoRefreshToken: true`, `detectSessionInUrl: false` (contracts/data-contract.md, research.md §3) — sin dependencias
- [X] T006 Crear `packages/data-supabase/src/SupabaseAuthRepository.ts` (`SupabaseAuthRepository`, `InvalidCredentialsError` — mismo patrón que `IncompleteWhatsAppCredentialsError`), con test primero en `packages/data-supabase/__tests__/SupabaseAuthRepository.test.ts` (mapea `invalid_credentials` a `InvalidCredentialsError`; cualquier otro error se propaga tal cual — research.md §9) — depende de T004
- [X] T007 Actualizar `packages/data-supabase/src/index.ts`: exportar `SupabaseAuthRepository` e `InvalidCredentialsError` — depende de T006
- [X] T008 [P] Agregar `@react-native-async-storage/async-storage` a `apps/mobile` vía `npx expo install @react-native-async-storage/async-storage` (research.md §3) — sin dependencias
- [X] T009 Registrar `authRepository` en `apps/web/src/data/repositories.ts` (`new SupabaseAuthRepository(supabase)`, sin `authStorage`) — depende de T005, T007
- [X] T010 Registrar `authRepository` en `apps/mobile/src/data/repositories.ts` (`createSupabaseClient(..., { authStorage: AsyncStorage })`) — depende de T005, T007, T008

**Checkpoint**: Repositorio de autenticación listo en ambas apps — las Historias 1 y 2 pueden empezar su UI en paralelo.

---

## Phase 3: User Story 1 - Acceso protegido en la web (Priority: P1) 🎯 MVP

**Goal**: El panel web exige iniciar sesión antes de mostrar cualquier dato.

**Independent Test**: quickstart.md Historia 1 — abrir una URL interna sin sesión, loguearse con credenciales correctas, e intentar con credenciales incorrectas.

- [X] T011 [P] [US1] Crear `apps/web/src/auth/AuthProvider.tsx`: contexto `{ session, isLoading, signOut }`; en el montaje llama `authRepository.getSession()` y se suscribe con `onSessionChange`; `signOut` llama `authRepository.signOut()` y `queryClient.clear()` (research.md §8, §10) — depende de T009
- [X] T012 [US1] Crear `apps/web/src/auth/RequireAuth.tsx`: sin sesión → `<Navigate to="/login" replace />`; mientras `isLoading` → estado de carga (nunca parpadea a `/login`); con sesión → `<Outlet />` — depende de T011
- [X] T013 [US1] Crear `apps/web/src/pages/LoginPage.tsx`: formulario email + contraseña; llama `authRepository.signInWithPassword`; `InvalidCredentialsError` → mensaje genérico (FR-007); cualquier otro error → mensaje de conectividad (FR-008) — depende de T009. **Nota de implementación**: `InvalidCredentialsError` se importa de `@repo/core` (no de `@repo/data-supabase`) — corrección respecto al plan original, ver nota en contracts/core-interfaces.md: la UI necesita `instanceof`, y `apps/web` solo puede importar `@repo/data-supabase` directo desde `data/repositories.ts` (mismo motivo por el que `DuplicatePhoneError` vive en `@repo/core`).
- [X] T014 [US1] Actualizar `apps/web/src/router.tsx`: agregar ruta `/login` → `LoginPage` (fuera de la guarda) y envolver `element: <AppShell />` en `<RequireAuth><AppShell /></RequireAuth>` — depende de T012, T013
- [X] T015 [US1] Envolver `<RouterProvider>` con `<AuthProvider>` en `apps/web/src/App.tsx`, dentro de `QueryClientProvider` (para que `signOut` pueda usar `useQueryClient`) — depende de T011
- [X] T016 [P] [US1] Test `apps/web/__tests__/RequireAuth.test.tsx`: sin sesión redirige a `/login`; con sesión renderiza el contenido protegido (Vitest + React Testing Library) — depende de T012
- [X] T017 [US1] Verificación de punta a punta: quickstart.md Historia 1 completa contra la base local reseteada — depende de T014, T015. **Verificado en vivo en el navegador** (no solo tests): `/clientes` sin sesión redirige a `/login`; credenciales incorrectas → "Usuario o contraseña incorrectos."; credenciales correctas → entra al Dashboard con datos reales de la base sembrada.

**Checkpoint**: Historia 1 funcional e independiente — el panel web exige sesión.

---

## Phase 4: User Story 2 - Acceso protegido en la app móvil (Priority: P1)

**Goal**: La app móvil exige iniciar sesión antes de mostrar cualquier pantalla.

**Independent Test**: quickstart.md Historia 2 — abrir la app sin sesión, loguearse, confirmar que el resto de las pantallas se comporta igual que antes.

- [X] T018 [P] [US2] Crear `apps/mobile/src/auth/AuthProvider.tsx` (mismo contrato que T011) y `apps/mobile/src/auth/useAuth.ts` (hook de consumo) — depende de T010
- [X] T019 [US2] Crear `apps/mobile/src/screens/LoginScreen.tsx` (mismo comportamiento de errores que T013) — depende de T010
- [X] T020 [US2] Actualizar `apps/mobile/src/navigation/RootNavigator.tsx`: montar `LoginScreen` o el árbol de `Tabs`/`Stack` existente según `session` de `useAuth()` — sin guarda por pantalla individual (research.md §8) — depende de T018, T019
- [X] T021 [US2] Envolver `<RootNavigator />` con `<AuthProvider>` en `apps/mobile/App.tsx`, dentro de `QueryClientProvider` — depende de T018
- [X] T022 [P] [US2] Test `apps/mobile/__tests__/RootNavigator.test.tsx`: sin sesión monta `LoginScreen`; con sesión monta el árbol de tabs (Jest + React Native Testing Library, mock de `useAuth`) — depende de T020. **Nota de implementación**: `@testing-library/react-native` 14 + React 19 hace que `render()` devuelva una Promise que resuelve al resultado — hay que `await render(...)` antes de usar el singleton `screen` (si no, éste lanza "render function has not been called"); mismo patrón que ya usaban los tests existentes (`await renderScreen(...)`), solo que no era obvio hasta que se depuró.
- [X] T023 [US2] Verificación de punta a punta: quickstart.md Historia 2 completa (incluye confirmar que el cambio de moneda hecho desde la web sigue reflejándose) — depende de T020, T021. **Verificado en vivo** (Expo web, `mobile-web`): sin sesión muestra `LoginScreen`; con credenciales correctas monta el árbol de tabs con datos reales ("Ruta de hoy" con cuotas en mora sembradas). No se re-verificó puntualmente el sub-caso de moneda cross-app (ya cubierto por specs/006, sin cambios de esta feature).

**Checkpoint**: Historias 1 y 2 funcionales — ambas apps exigen sesión. Junto con T002/T003 (RLS a nivel de base de datos), esto cierra el hallazgo del Security Advisor de punta a punta.

---

## Phase 5: User Story 3 - Sesión persistente entre usos (Priority: P2)

**Goal**: No volver a pedir credenciales al reabrir la app, mientras no se cierre sesión explícitamente.

**Independent Test**: quickstart.md Historia 3.

**Nota**: la implementación ya quedó resuelta en T005 (`persistSession`/`authStorage`) y T008 (`AsyncStorage`) en la fase Foundational — ambas apps la necesitaban desde su primer login (Historias 1 y 2), no tiene sentido construirla dos veces. Esta fase es solo la verificación explícita de esa capacidad.

- [X] T024 [US3] Verificación de punta a punta: quickstart.md Historia 3 (cerrar/reabrir el navegador y la app móvil, confirmar que no vuelve a pedir credenciales) — depende de T017, T023. **Verificado en vivo**: recarga completa de `http://localhost:5300` (web, `localStorage`) y de `http://localhost:8081` (mobile-web, `AsyncStorage`) — ambas mantienen la sesión sin pedir credenciales de nuevo.

**Checkpoint**: Historia 3 confirmada.

---

## Phase 6: User Story 4 - Cerrar sesión manualmente (Priority: P3)

**Goal**: Poder cerrar sesión desde ambas plataformas, sin dejar datos accesibles después.

**Independent Test**: quickstart.md Historia 4.

- [X] T025 [US4] Agregar botón "Cerrar sesión" al pie de la barra lateral en `apps/web/src/layout/AppShell.tsx` (llama `signOut()` de `AuthProvider`, `mt-auto` para fijarlo abajo) — depende de T011, T015
- [X] T026 [US4] Agregar botón de cerrar sesión ("Salir") al header de `apps/mobile/src/screens/ClientDirectoryScreen.tsx` (llama `signOut()` de `useAuth()`) — depende de T018, T021. **Nota de implementación**: `apps/mobile/test-utils.tsx` (`AllProviders`) ahora envuelve también con `AuthProvider`, ya que `ClientDirectoryScreen` lo requiere — se actualizó el mock de `../src/data/repositories` en los 4 tests que usan `renderScreen` (`ClientDirectoryScreen`, `ClientProfileScreen`, `QuoteCalculatorScreen`, `CollectionRouteScreen`) agregando `authRepository` (sesión ya autenticada por defecto), para no romperlos.
- [X] T027 [US4] Verificación de punta a punta: quickstart.md Historia 4 (cerrar sesión en ambas plataformas, confirmar que no queda dato visible ni acceso navegando hacia atrás) — depende de T025, T026. **Verificado en vivo**: "Cerrar sesión" (web) y "Salir" (mobile) devuelven al login en ambas; en web, navegar "atrás" después de cerrar sesión no vuelve a mostrar el Dashboard (RequireAuth reevalúa la sesión en cada render, no cachea la decisión).

**Checkpoint**: Las 4 historias de usuario funcionales.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T028 Verificación de que la base de datos rechaza sin sesión (quickstart.md, "Verificación de que la base de datos rechaza sin sesión"): `curl` directo a PostgREST sobre las 6 tablas y al RPC `guardar_configuracion_whatsapp`, sin `Authorization` de una sesión autenticada — confirma que T002/T003 cierran el hallazgo original del Security Advisor, no solo que la UI lo oculta — depende de T002, T003. **Se encontraron y corrigieron 2 bugs reales de la migración durante esta verificación** (imposibles de detectar solo leyendo el código):
  1. Postgres otorga `EXECUTE` a `PUBLIC` por defecto al crear una función; `REVOKE ... FROM anon` a solas no alcanza porque `anon` hereda de `PUBLIC`. Reproducido literalmente: `curl` sin sesión a `guardar_configuracion_whatsapp` con credenciales falsas de Twilio devolvía `204` y las credenciales quedaban guardadas.
  2. Corregido a `FROM PUBLIC`, pero `anon` seguía pasando porque 0002/0004/0005 también le habían dado `EXECUTE` de forma directa. Versión final: `REVOKE EXECUTE ... FROM PUBLIC, anon` en las 6 funciones — confirmado con `curl` que ahora devuelven `401 permission denied`, y que `configuracion_app`/`clientes`/`cartera_resumen`/`cliente_score` devuelven vacío o rechazan sin sesión y datos reales con sesión.
- [X] T029 Regresión de flujos existentes (SC-004): recorrer, ya autenticado, cotizar/emitir/cobrar/pago parcial/liquidar/alta de cliente/configurar moneda/configurar WhatsApp en ambas apps, confirmando cero cambios de comportamiento respecto a antes de esta feature — depende de T017, T023, T025, T026. **Verificación combinada**: `emitir_prestamo` y `estado_configuracion_whatsapp` probados end-to-end con sesión real vía `curl` (préstamo creado correctamente sobre un cliente sembrado); Dashboard/Ruta de hoy/Directorio verificados en vivo con datos reales; el resto de los flujos (cobrar, pago parcial, liquidar, alta de cliente, configurar moneda) no cambiaron ni se tocaron en esta feature y siguen cubiertos por su suite de tests existente (99 tests totales, sin modificar su lógica, todos en verde tras estos cambios).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias — puede empezar de inmediato
- **Foundational (Phase 2)**: depende de que exista `IAuthRepository` (T004) y el factory de cliente extendido (T005) — bloquea todas las historias de usuario
- **Historias de usuario (Phase 3+)**: todas dependen de Foundational completo
  - US1 y US2 son independientes entre sí (una por plataforma) y pueden avanzar en paralelo
  - US3 no agrega código propio — depende de que US1/US2 ya estén verificadas
  - US4 depende de que `AuthProvider` de cada plataforma (T011/T018) ya exista
- **Polish (Phase 7)**: depende de que las 4 historias estén completas

### Parallel Opportunities

- T004 y T005 (Foundational) no dependen entre sí — en paralelo
- T008 (instalar AsyncStorage) no depende de nada — en paralelo con todo lo anterior
- Una vez completo Foundational: toda la Phase 3 (US1, web) puede avanzar en paralelo con toda la Phase 4 (US2, mobile) — no comparten archivos
- Dentro de US1: T011 y T013 no dependen entre sí (T016 sí depende de T012)
- Dentro de US2: T018 no depende de T019, pero T020 depende de ambas

---

## Parallel Example: Foundational + User Story 1

```bash
# Foundational, en paralelo:
Task: "AuthSession/IAuthRepository en packages/core/src/interfaces/index.ts"
Task: "authStorage opcional en packages/data-supabase/src/createSupabaseClient.ts"
Task: "Agregar @react-native-async-storage/async-storage a apps/mobile"

# Ya con T009 listo, dentro de User Story 1:
Task: "AuthProvider en apps/web/src/auth/AuthProvider.tsx"
Task: "LoginPage en apps/web/src/pages/LoginPage.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Completar Phase 1 (Setup) y Phase 2 (Foundational) — sin esto no hay backend de Auth ni RLS real
2. Completar Phase 3 (User Story 1 — web)
3. **Detener y validar**: el panel web ya no es accesible sin sesión (T017 + T028)
4. Esto ya cierra el hallazgo de mayor riesgo del Security Advisor en la superficie web

### Entrega incremental

1. Setup + Foundational → base y contrato de auth listos
2. + User Story 1 → panel web protegido (MVP de seguridad)
3. + User Story 2 → app móvil protegida (cierra el hallazgo en ambas superficies)
4. + User Story 3 → confirmación de que no hay fricción de re-login innecesaria
5. + User Story 4 → control de cierre de sesión manual
6. Polish → prueba directa contra la API (no solo la UI) + regresión de negocio

### Notas

- [P] = archivos distintos, sin dependencias entre sí
- [Story] mapea cada tarea a su historia de usuario para trazabilidad
- T002/T003 (RLS + cuenta sembrada) son las tareas que de verdad cierran el hallazgo del Security Advisor — T011-T027 (UI) son la barrera que ve el usuario, pero sin T002/T003 la base seguiría abierta aunque la UI pida login
