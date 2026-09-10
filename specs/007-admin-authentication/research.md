# Research: Autenticación del administrador (Supabase Auth)

## 1. Servicio Auth local está apagado hoy

**Hallazgo**: `supabase/config.toml` tiene `[auth] enabled = false`, con un comentario explícito: *"Sin uso: 0 referencias a `.auth.*` en todo el repo... nunca se valida un usuario real"*. `[studio] enabled = false` también (commit `ac29282`, "Trim local Supabase stack to db+rest+kong only").

**Decisión**: Activar `[auth] enabled = true` en `config.toml`. Sin esto, `supabase.auth.signInWithPassword` no tiene backend (GoTrue) que le responda en local — el login fallaría por conexión rechazada, no por credenciales.

**Studio sigue apagado**: no se reactiva. No se necesita para nada de este flujo (ver §5, aprovisionamiento por seed en vez de por UI).

## 2. Auto-registro público debe quedar cerrado, en ambos ambientes

**Hallazgo crítico**: `config.toml` trae `enable_signup = true` por defecto (nunca se había tocado, porque Auth estaba apagado). Si se deja así, el endpoint público `/auth/v1/signup` queda abierto: cualquiera podría autorregistrarse y obtener una sesión `authenticated` válida — y las políticas RLS de §4 solo distinguen "autenticado" de "no autenticado", no "es el administrador legítimo". Un auto-registro exitoso pasaría las políticas igual que la cuenta real.

**Decisión**: `enable_signup = false` en `config.toml` (local) **y** desactivar "Allow new users to sign up" en el dashboard de producción (Authentication → Providers → Email) — son dos sistemas distintos, hay que tocar los dos. Esto es lo que hace cumplir FR-006 a nivel de plataforma, no solo "no construir una pantalla de registro" a nivel de UI.

## 3. Persistencia de sesión: `persistSession` está en `false` hoy, para ambas apps

**Hallazgo**: `packages/data-supabase/src/createSupabaseClient.ts` fija `auth: { persistSession: false }` — decisión correcta cuando no existía ningún concepto de sesión, pero bloquea directamente la Historia 3 (sesión persistente) si no se cambia.

**Decisión**: Extender `createSupabaseClient(url, anonKey, options?)` con un tercer parámetro opcional `{ authStorage？: SupportedStorage }`, y activar `persistSession: true` + `autoRefreshToken: true` + `detectSessionInUrl: false` para ambas apps.

- **apps/web**: no pasa `authStorage` — `supabase-js` usa `window.localStorage` por defecto en un entorno de navegador. `localStorage` sobrevive a cerrar/reabrir el navegador (Historia 3, escenario 1).
- **apps/mobile**: no hay `localStorage` en React Native. Se usa `@react-native-async-storage/async-storage` como adaptador (`authStorage: AsyncStorage`) — es la integración oficialmente documentada por Supabase para Expo/React Native, persiste en el almacenamiento nativo del dispositivo (Historia 3, escenario 2). Se agrega como dependencia nueva vía `npx expo install @react-native-async-storage/async-storage` (no `npm install` directo, para que Expo resuelva la versión nativa compatible con el SDK 57 ya en uso).

**Alternativa descartada**: implementar persistencia propia (guardar el token a mano). Reinventa lo que `supabase-js` ya resuelve de forma robusta (refresh automático incluido) — viola Principio V (YAGNI).

## 4. RLS: una sola política por tabla, sin aislar por usuario

**Decisión**: Para las 6 tablas (`clientes`, `prestamos`, `cuotas`, `cobros`, `configuracion_app`, `notificaciones_whatsapp`):

```sql
ALTER TABLE <tabla> ENABLE ROW LEVEL SECURITY;
CREATE POLICY "<tabla>_authenticated_all" ON <tabla>
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

Ninguna política para `anon` → con RLS activo y sin política, el acceso se deniega por defecto (comportamiento de Postgres, no algo que haya que declarar aparte). Esto es exactamente lo que exige FR-003.

**Por qué no aislar por `user_id`**: sigue existiendo un único administrador (spec.md raíz §1, y exclusión explícita de esta spec: "fuera de alcance: multi-tenencia"). No hay una segunda cuenta de la que aislarse — agregar una columna `user_id` y filtrar por ella sería complejidad sin un segundo consumidor que la justifique (Principio V, YAGNI, mismo criterio que ya usó `IWhatsAppConfigRepository`/`IAppSettingsRepository` para no separar lectura/escritura sin un segundo consumidor real).

## 5. Vistas derivadas: hay que fijar `security_invoker`, si no la RLS de arriba no las cubre

**Hallazgo**: `cliente_score`, `cartera_resumen` y `cartera_tendencia_mensual` (`0001_initial_schema.sql`, `0004_pagos_parciales.sql`) se crearon con `CREATE VIEW` liso — en Postgres, una vista así corre con los privilegios de su dueño (quien corrió la migración), no de quien consulta. Activar RLS en las tablas base (§4) **no** protege estas vistas: seguirían devolviendo todas las filas a cualquiera, ignorando las políticas nuevas.

**Decisión**:

```sql
ALTER VIEW cliente_score SET (security_invoker = true);
ALTER VIEW cartera_resumen SET (security_invoker = true);
ALTER VIEW cartera_tendencia_mensual SET (security_invoker = true);
```

Con esto, cada vista ejecuta como el rol que la consulta — hereda las políticas de §4 automáticamente, sin duplicar lógica de acceso (FR-009).

## 6. Funciones RPC: revocar `EXECUTE` de `PUBLIC`, no solo confiar en RLS

**Corrección post-implementación, dos rondas** (verificado end-to-end con `curl` contra el stack local, no solo leyendo el código):

1. La primera versión de esta migración revocaba `EXECUTE` solo de `anon`. Postgres otorga `EXECUTE` a `PUBLIC` automáticamente al crear una función, salvo que se revoque explícitamente — ninguna migración anterior lo había hecho, y `anon` es miembro implícito de `PUBLIC` como cualquier rol. Resultado: `guardar_configuracion_whatsapp` seguía ejecutándose sin sesión (probado literalmente inyectando credenciales falsas de Twilio vía `curl` sin `Authorization`, y confirmando que quedaron guardadas).
2. Corregido a `REVOKE EXECUTE ... FROM PUBLIC` — pero `anon` **seguía** teniendo acceso, porque 0002/0004/0005 además le habían otorgado `EXECUTE` de forma **directa** (`GRANT ... TO anon, authenticated`), un privilegio propio que no depende de PUBLIC y que revocar de PUBLIC no toca. Mismo `curl` repetido, mismo resultado positivo (credenciales falsas guardadas de nuevo).

La versión final revoca de **ambos** a la vez: `REVOKE EXECUTE ... FROM PUBLIC, anon`. El `GRANT` directo a `authenticated` no se ve afectado (es un privilegio propio e independiente). Las tablas no tienen este problema: a diferencia de las funciones, Postgres no otorga privilegios a `PUBLIC` sobre tablas nuevas por defecto — por eso el `curl` sin sesión contra `/rest/v1/clientes` ya daba `[]` desde la primera ronda.

**Hallazgo, verificado línea por línea contra las migraciones**:

| Función | `SECURITY` | ¿La protege la RLS de §4 sola? |
|---|---|---|
| `emitir_prestamo(...)` (`0002`) | invocador (default) | Sí — corre como `anon` si la llama `anon`, y `anon` ya no tiene política de escritura. Pero dejar el `GRANT EXECUTE ... TO anon` da un error confuso (falla adentro de la función) en vez de un rechazo limpio. |
| `registrar_cobro(UUID, NUMERIC)` (`0004`) | invocador (default) | Igual que arriba. |
| `liquidar_prestamo(UUID)` (`0004`) | invocador (default) | Igual que arriba. |
| `estado_configuracion_whatsapp()` (`0005`) | **`SECURITY DEFINER`** | **No.** Corre con los privilegios de quien la creó (`postgres`), ignora RLS por diseño (así lee `vault.decrypted_secrets`, que `anon`/`authenticated` no pueden tocar directo). Si `anon` conserva `EXECUTE`, puede seguir llamándola sin sesión. |
| `guardar_configuracion_whatsapp(TEXT, TEXT, TEXT)` (`0005`) | **`SECURITY DEFINER`** | **No** — mismo caso, y este además **escribe** las credenciales de Twilio en Vault. Es el hallazgo más serio de este punto: hoy cualquiera con la `anon key` puede sobrescribir la conexión de WhatsApp sin autenticarse. |
| `borrar_configuracion_whatsapp()` (`0005`) | **`SECURITY DEFINER`** | **No** — mismo caso, borra las credenciales. |

**Decisión**: `REVOKE EXECUTE ON FUNCTION <firma exacta> FROM anon;` para las 6, dejando intacto el `GRANT ... TO authenticated` que ya tienen desde su migración original. Firmas exactas (ya usadas tal cual en sus propios `GRANT` originales, para que el `REVOKE` matchee):

- `emitir_prestamo(UUID, NUMERIC, NUMERIC, estrategia_interes, INTEGER, frecuencia_pago, DATE, JSONB)`
- `registrar_cobro(UUID, NUMERIC)` (la única firma viva — `registrar_cobro(UUID)` fue eliminada en `0004` con `DROP FUNCTION IF EXISTS`)
- `liquidar_prestamo(UUID)`
- `estado_configuracion_whatsapp()`
- `guardar_configuracion_whatsapp(TEXT, TEXT, TEXT)`
- `borrar_configuracion_whatsapp()`

`revisar_y_enviar_notificaciones_whatsapp()` (el job del cron) nunca tuvo `GRANT` a `anon`/`authenticated` — corre como `postgres` vía `cron.schedule`. No requiere cambios.

## 7. Aprovisionar la única cuenta administradora

**Producción**: manual, una sola vez, fuera de las apps (FR-006) — Supabase Dashboard del proyecto → Authentication → Users → "Add user", con email + contraseña. El dashboard de producción existe y es accesible (ya se usó para revisar el Security Advisor).

**Local (`supabase db reset`)**: Studio está apagado (§1) y no hay flujo de registro (§2), así que no hay UI para crear el usuario a mano. Se agrega un insert directo a `auth.users` + `auth.identities` en `supabase/seed.sql`, usando `pgcrypto` (`crypt(password, gen_salt('bf'))`) para el hash — mismo mecanismo que usa GoTrue internamente para contraseñas con el proveedor `email`.

**Alternativa considerada y descartada**: llamar al Admin API de GoTrue (`POST /auth/v1/admin/users` con el `service_role` key) desde un script aparte. Es más "correcto" (usa la API pública de administración en vez de tocar tablas internas de GoTrue), pero rompe el flujo de un solo comando que ya usa todo el equipo (`supabase db reset` dejando la base 100% lista — Historia 6 de `specs/006-rebrand-currency-polish/`): requeriría un paso manual extra después del reset. Se acepta el trade-off de depender de un detalle interno de esquema de GoTrue **solo en desarrollo local** — si una futura versión de la imagen de Supabase CLI cambia ese esquema, el seed de auth se ajusta ahí mismo, sin afectar producción (que nunca corre este seed).

**Credenciales de desarrollo**: `admin@prestly.local` / una contraseña fija de desarrollo, documentadas en `quickstart.md` (nunca las mismas que producción).

## 8. Guardas de acceso en cada app

**apps/web (React Router 7, `createBrowserRouter`)**: un componente `RequireAuth` que envuelve el árbol de rutas protegidas (hoy montado como `element: <AppShell />` en `router.tsx`) — si no hay sesión, redirige a `/login` (`<Navigate to="/login" replace />`); si hay sesión, renderiza `<Outlet />`. Mientras se resuelve la sesión inicial (`getSession()` en curso), se muestra un estado de carga en vez de parpadear a `/login` y volver.

**apps/mobile (React Navigation)**: en vez de una guarda por pantalla, `RootNavigator` monta condicionalmente un árbol u otro según haya sesión — patrón estándar de React Navigation para flujos de autenticación (cambiar qué navegador está montado, no interceptar cada pantalla individualmente).

**Alternativa descartada**: proteger cada pantalla individualmente (repetir la comprobación en cada `Screen`/`Page`). Es el mismo patrón que ya evita este proyecto en otros lados (un solo punto de verdad) — una sola guarda en el punto de entrada es suficiente y no se puede rodear navegando directo a una ruta interna (Edge Cases de spec.md).

## 9. Distinguir error de credenciales de error de red (FR-007, FR-008)

**Decisión**: `SupabaseAuthRepository.signInWithPassword` inspecciona el error que devuelve `supabase-js`: si es un `AuthApiError` con código `invalid_credentials` (credenciales incorrectas — así responde GoTrue, sin distinguir si falló el email o la contraseña), se relanza como `InvalidCredentialsError` (mismo patrón que `InstallmentAlreadyPaidError`/`IncompleteWhatsAppCredentialsError` ya usado en este paquete). Cualquier otro error (fetch fallido, timeout, DNS) se deja propagar tal cual — las pantallas de login distinguen por `instanceof InvalidCredentialsError` para el mensaje genérico (FR-007) vs. cualquier otro error para el mensaje de conectividad (FR-008).

## 10. Limpiar caché al cerrar sesión (FR-005)

**Decisión**: el `signOut()` de cada app, además de invalidar la sesión de Supabase, llama a `queryClient.clear()` de React Query — vacía todo lo cacheado (clientes, préstamos, cuotas) para que no quede visible a quien use el dispositivo después. Es una sola línea en el punto donde ya existe el `QueryClient` (`App.tsx` de ambas apps), no un mecanismo nuevo.
