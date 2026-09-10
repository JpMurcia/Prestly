# Implementation Plan: Autenticación del administrador (Supabase Auth)

**Branch**: `007-admin-authentication` | **Date**: 2026-09-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/007-admin-authentication/spec.md`

## Summary

Cierra el hallazgo crítico del Security Advisor de Supabase (RLS deshabilitado en 6 tablas + 3 vistas `SECURITY DEFINER`-por-omisión, producción sin ninguna barrera de acceso) agregando login real con Supabase Auth: (1) activar el servicio Auth local (estaba apagado, `config.toml`) y cerrar el auto-registro público en ambos ambientes; (2) políticas RLS de una sola regla (`authenticated` sí, `anon` no) en las 6 tablas, `security_invoker` en las 3 vistas derivadas, y revocar `EXECUTE` de `anon` en las 6 funciones RPC que hoy lo tienen — 3 de ellas `SECURITY DEFINER` y por lo tanto invisibles para la RLS de las tablas; (3) sesión persistente real en ambas apps (`persistSession` estaba en `false` desde siempre) vía `localStorage` (web) y `AsyncStorage` (mobile, dependencia nueva); (4) una pantalla de login + una guarda de acceso por app (React Router en web, árbol condicional en React Navigation en mobile) y un botón de cerrar sesión que también limpia la caché de React Query. Sin proyectos nuevos, sin multi-tenencia, sin recuperación de contraseña por email (spec.md, Assumptions).

## Technical Context

**Language/Version**: TypeScript (apps/web, apps/mobile, @repo/core, packages/data-supabase) + SQL (migración Postgres)

**Primary Dependencies**: `@supabase/supabase-js` (ya en uso, ahora también su módulo `auth`); `@react-native-async-storage/async-storage` (nueva, solo `apps/mobile`, instalada vía `npx expo install` para la versión nativa correcta del SDK 57); `react-router-dom` (ya en uso, se agrega una ruta y un wrapper de guarda); `@react-navigation/*` (ya en uso, sin paquetes nuevos)

**Storage**: PostgreSQL/Supabase — sin tablas nuevas de negocio; cambios de RLS/policies/grants sobre las 6 tablas y 3 vistas ya existentes (`data-model.md`). La cuenta administradora vive en `auth.users` (gestionado por Supabase Auth, no por una migración de esquema propia).

**Testing**: Jest (`packages/data-supabase`: `SupabaseAuthRepository` — mapeo de errores, `InvalidCredentialsError` vs. error de red, mismo patrón que `SupabaseWhatsAppConfigRepository.test.ts`), Vitest + React Testing Library (`apps/web`: `RequireAuth` redirige sin sesión / renderiza con sesión, `LoginPage` mensajes de error), Jest + React Native Testing Library (`apps/mobile`: `RootNavigator` monta login vs. tabs según sesión); verificación de punta a punta contra Postgres local recién reseteado incluyendo un `curl` directo a PostgREST sin sesión (quickstart.md, "Verificación de que la base de datos rechaza sin sesión") — es la única forma de probar FR-003 de verdad, una captura de pantalla de la UI no alcanza.

**Target Platform**: Web (React 19 + Vite) y Mobile (Expo/React Native); Supabase Auth (GoTrue) local vía Supabase CLI y en el proyecto de producción ya existente

**Project Type**: Web + mobile sobre el monorepo ya existente — solo archivos dentro de `apps/web`, `apps/mobile`, `packages/core`, `packages/data-supabase`, `supabase/migrations`, `supabase/seed.sql`, `supabase/config.toml`. Sin paquete nuevo.

**Performance Goals**: Los ya vigentes de fases anteriores; resolver la sesión inicial (`getSession()`) no debe bloquear más de lo que ya tarda un refresco de pantalla normal — se muestra un estado de carga breve, nunca un parpadeo a `/login` seguido de vuelta al panel (Edge Cases de spec.md).

**Constraints**: Una sola cuenta administradora, sin flujo de auto-registro ni de recuperación de contraseña por email (spec.md, Assumptions) — no se agrega infraestructura de correo transaccional. Sesión sin expiración por inactividad (solo cierre de sesión explícito o expiración natural del refresh token de Supabase).

**Scale/Scope**: Single-tenant (igual que fases 1-6) — 4 historias de usuario, 0 tablas nuevas, 1 migración de seguridad (`0007_auth_rls.sql`), 1 interfaz nueva en `@repo/core` (`IAuthRepository`), 1 implementación nueva en `packages/data-supabase`, 1 pantalla de login por app + 1 guarda de acceso + 1 botón de cerrar sesión.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. SOLID estricto en @repo/core** — PASS. `IAuthRepository` es la abstracción (DIP); `packages/data-supabase` la implementa contra Supabase Auth. No se separa lectura/escritura estilo ISP porque, igual que `IAppSettingsRepository`/`IWhatsAppConfigRepository`, hay un único consumidor real (`AuthProvider`, uno por app) que siempre necesita todo el contrato junto — separar sería una abstracción sin un segundo consumidor que la justifique.
- **II. Motor financiero único** — N/A. Esta feature no toca cálculo de intereses ni amortización.
- **III. Test-First para el motor financiero** — N/A para `AmortizationCalculator` (sin cambios). `SupabaseAuthRepository` (el único código nuevo con lógica real — mapeo de errores) lleva test Jest antes de su implementación, mismo estándar de rigor que el principio exige para código con lógica de negocio, aunque viva en `packages/data-supabase` y no en `packages/core`.
- **IV. Estado derivado sobre estado almacenado** — PASS, sin cambios: la sesión activa no es un dato de negocio derivado ni almacenado por la app — la gestiona `supabase-js` por su cuenta (research.md §3). Ninguna tabla de negocio gana una columna derivada nueva.
- **V. Simplicidad (YAGNI)** — PASS, con una decisión explícita: RLS de una sola regla (`authenticated` sí, sin aislar por `user_id`) porque sigue habiendo un único administrador — replicar un esquema de roles/multi-tenencia aquí sería complejidad sin un segundo usuario que la justifique (exclusión explícita del alcance, spec.md). Se descarta recuperación de contraseña por email (sin infraestructura de correo hoy) y expiración de sesión por inactividad (sin un segundo usuario compartiendo el dispositivo que lo justifique) — ambas documentadas como asunciones en spec.md, no como corte de alcance no revisado.

Sin violaciones que requieran la tabla de Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/007-admin-authentication/
├── plan.md              # Este archivo
├── research.md          # Fase 0 — decisiones técnicas y su justificación
├── data-model.md         # Fase 1 — cambios de RLS/policies/grants, cuenta administradora
├── contracts/
│   ├── core-interfaces.md # Fase 1 — IAuthRepository/AuthSession/InvalidCredentialsError
│   └── data-contract.md   # Fase 1 — migración SQL, config.toml, SupabaseAuthRepository
├── quickstart.md          # Fase 1 — guía de verificación de punta a punta
└── tasks.md               # Fase 2 (/speckit-tasks — no generado por /speckit-plan)
```

### Source Code (repository root)

```text
supabase/
├── config.toml                       # [auth] enabled=true, enable_signup=false
├── migrations/0007_auth_rls.sql      # NUEVO — RLS + security_invoker + revoke de las 6 funciones
└── seed.sql                          # + cuenta admin@prestly.local (auth.users/auth.identities)

packages/core/src/
└── interfaces/index.ts               # + AuthSession, InvalidCredentialsError, IAuthRepository (el error vive acá, no en data-supabase, porque la UI sí lo discrimina con instanceof — mismo criterio que DuplicatePhoneError)

packages/data-supabase/src/
├── createSupabaseClient.ts           # + tercer parámetro opcional { authStorage }
├── SupabaseAuthRepository.ts         # NUEVO
└── index.ts                          # export de lo de arriba

apps/web/
├── package.json                     # sin dependencias nuevas
├── src/
│   ├── App.tsx                      # + <AuthProvider> envolviendo <RouterProvider>
│   ├── auth/
│   │   ├── AuthProvider.tsx          # NUEVO — sesión + isLoading + signOut (limpia queryClient)
│   │   ├── useAuth.ts                # NUEVO — hook de consumo (separado del provider por Fast Refresh)
│   │   └── RequireAuth.tsx           # NUEVO — redirige a /login sin sesión
│   ├── pages/
│   │   └── LoginPage.tsx             # NUEVO
│   ├── layout/AppShell.tsx           # + botón "Cerrar sesión" al pie de la barra lateral
│   ├── data/repositories.ts          # + export const authRepository
│   └── router.tsx                    # + ruta /login; element: <RequireAuth><AppShell /></RequireAuth>

apps/mobile/
├── package.json                     # + @react-native-async-storage/async-storage
├── App.tsx                          # + <AuthProvider> envolviendo <RootNavigator>
├── src/
│   ├── auth/
│   │   ├── AuthProvider.tsx          # NUEVO — mismo contrato que la versión web
│   │   └── useAuth.ts                # NUEVO — hook de consumo del contexto
│   ├── screens/
│   │   ├── LoginScreen.tsx           # NUEVO
│   │   └── ClientDirectoryScreen.tsx # + botón de cerrar sesión en el header
│   ├── data/repositories.ts          # + export const authRepository (con authStorage: AsyncStorage)
│   └── navigation/RootNavigator.tsx  # monta LoginScreen o el árbol existente según sesión
```

**Structure Decision**: Se extiende el monorepo ya existente, sin paquetes ni apps nuevas. `IAuthRepository` sigue el mismo patrón de todos los repositorios anteriores (interfaz en `@repo/core`, implementación única en `packages/data-supabase`, instanciada una vez por app en su propio `data/repositories.ts` — igual criterio documentado en `apps/web/src/data/repositories.ts` para `@repo/data-supabase`: "Único punto que importa @repo/data-supabase directamente"). `AuthProvider`/`RequireAuth` se duplican una vez por plataforma (mismo criterio que `NewClientModal` en `specs/006-rebrand-currency-polish/`: componentes de plataforma con el mismo contrato conceptual, sin forzar una capa cross-platform que hoy no existe en `packages/ui`) porque el mecanismo de guarda de cada plataforma es intrínsecamente distinto (React Router vs. React Navigation) — no hay abstracción común real que compartir, solo el contrato de datos (`IAuthRepository`), que sí es compartido.

## Complexity Tracking

*Sin violaciones a la constitución — tabla omitida.*
