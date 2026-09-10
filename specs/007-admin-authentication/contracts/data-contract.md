# Contract: esquema SQL, configuración de Supabase y acceso desde `supabase-js`

## Migración `0007_auth_rls.sql`

```sql
-- RLS en las 6 tablas (research.md §4) — una sola policy, sin aislar por usuario
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clientes_authenticated_all" ON clientes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE prestamos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prestamos_authenticated_all" ON prestamos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE cuotas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cuotas_authenticated_all" ON cuotas
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE cobros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cobros_authenticated_all" ON cobros
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE configuracion_app ENABLE ROW LEVEL SECURITY;
CREATE POLICY "configuracion_app_authenticated_all" ON configuracion_app
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE notificaciones_whatsapp ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notificaciones_whatsapp_authenticated_all" ON notificaciones_whatsapp
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Vistas derivadas: sin esto, RLS de arriba no las cubre (research.md §5)
ALTER VIEW cliente_score SET (security_invoker = true);
ALTER VIEW cartera_resumen SET (security_invoker = true);
ALTER VIEW cartera_tendencia_mensual SET (security_invoker = true);

-- Funciones RPC: cerrar el acceso sin sesión, incluidas las 3 SECURITY DEFINER de WhatsApp
-- que RLS no cubre (research.md §6) — firmas exactas, iguales a su GRANT original.
-- FROM PUBLIC, anon (no solo FROM anon): Postgres otorga EXECUTE a PUBLIC por defecto al crear
-- una función, y `anon` es miembro implícito de PUBLIC; además 0002/0004/0005 otorgaron EXECUTE
-- a `anon` de forma directa. Hay que revocar los dos — verificado con curl contra el stack local
-- en dos rondas: primero seguía abierta vía PUBLIC, después vía el GRANT directo a anon.
REVOKE EXECUTE ON FUNCTION emitir_prestamo(
  UUID, NUMERIC, NUMERIC, estrategia_interes, INTEGER, frecuencia_pago, DATE, JSONB
) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION registrar_cobro(UUID, NUMERIC) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION liquidar_prestamo(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION estado_configuracion_whatsapp() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION guardar_configuracion_whatsapp(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION borrar_configuracion_whatsapp() FROM PUBLIC, anon;
```

## `config.toml` (local — research.md §1, §2)

```toml
[auth]
enabled = true        # era false
enable_signup = false # era true
```

`[studio]` se deja como está (`enabled = false`) — no se necesita para nada de este flujo.

## Producción (fuera de `config.toml` — dashboard del proyecto)

- Authentication → Providers → Email → desactivar "Allow new users to sign up" (research.md §2).
- Authentication → Users → "Add user" para crear la única cuenta administradora (research.md §7) — email + contraseña reales, distintas de las de desarrollo.

## `supabase/seed.sql` (agregado al final del archivo existente — research.md §7)

```sql
-- Cuenta administradora de desarrollo (nunca corre en producción — seed.sql no se aplica ahí).
-- admin@prestly.local / Prestly-Dev-007!
-- confirmation_token/recovery_token/email_change_token_new/email_change no tienen default en
-- este esquema de GoTrue (quedan NULL si se omiten); su driver Go rechaza NULL ahí con
-- "Scan error ... converting NULL to string is unsupported" al hacer login — se fuerzan a ''
-- explícitamente (verificado contra supabase_auth_Prestly:v2.196.0 corriendo local).
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values (
  '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
  'admin@prestly.local', crypt('Prestly-Dev-007!', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}', '{}', false, false,
  '', '', '', ''
);

insert into auth.identities (
  id, provider_id, user_id, identity_data, provider, created_at, updated_at, last_sign_in_at
)
select
  gen_random_uuid(), id::text, id,
  jsonb_build_object('sub', id::text, 'email', email), 'email', now(), now(), now()
from auth.users where email = 'admin@prestly.local';
```

Requiere `pgcrypto` para `crypt()`/`gen_salt()` — se agrega `CREATE EXTENSION IF NOT EXISTS pgcrypto;` al inicio de `0007_auth_rls.sql` (idéntico patrón `IF NOT EXISTS` que ya usan `pg_cron`/`pg_net` en `0005_whatsapp_automation.sql`).

## `createSupabaseClient` (extendido — research.md §3)

```ts
// packages/data-supabase/src/createSupabaseClient.ts
export function createSupabaseClient(
  url: string,
  anonKey: string,
  options?: { authStorage?: import('@supabase/supabase-js').SupportedStorage }
): SupabaseClient {
  // ...validación existente...
  return createClient(url, anonKey, {
    auth: {
      persistSession: true,      // antes: false
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storage: options?.authStorage, // undefined en web → localStorage por defecto de supabase-js
    },
  });
}
```

## `SupabaseAuthRepository` (implementa `IAuthRepository`)

```ts
// packages/data-supabase/src/SupabaseAuthRepository.ts
// InvalidCredentialsError se importa de @repo/core (contracts/core-interfaces.md) — no se
// redefine aquí, a diferencia de IncompleteWhatsAppCredentialsError.
export class SupabaseAuthRepository implements IAuthRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async getSession(): Promise<AuthSession | null> {
    // this.supabase.auth.getSession() → mapear data.session?.user a AuthSession, o null
  }

  onSessionChange(callback: (session: AuthSession | null) => void): () => void {
    // this.supabase.auth.onAuthStateChange((_event, session) => callback(mapeo o null))
    // devuelve () => subscription.unsubscribe()
  }

  async signInWithPassword(email: string, password: string): Promise<AuthSession> {
    // this.supabase.auth.signInWithPassword({ email, password })
    // si error.code === 'invalid_credentials' (o status 400) → throw new InvalidCredentialsError()
    // cualquier otro error → throw error tal cual (research.md §9)
  }

  async signOut(): Promise<void> {
    // this.supabase.auth.signOut()
  }
}
```

## Instanciación en cada app (`src/data/repositories.ts`)

- `packages/data-supabase/src/index.ts` exporta `SupabaseAuthRepository` (`InvalidCredentialsError` se importa directo de `@repo/core`, no se re-exporta desde acá).
- **apps/web**: `createSupabaseClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)` (sin `authStorage`) → `export const authRepository = new SupabaseAuthRepository(supabase);`
- **apps/mobile**: `createSupabaseClient(EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, { authStorage: AsyncStorage })` → mismo `authRepository`, importando `AsyncStorage` de `@react-native-async-storage/async-storage`.

## Consumo en cada app

- **`AuthProvider`** (uno por app, mismo contrato): en el montaje llama `getSession()` y se suscribe con `onSessionChange`; expone `{ session, isLoading, signOut }` por contexto. `signOut` llama a `authRepository.signOut()` y a `queryClient.clear()` (FR-005, research.md §10).
- **apps/web**: `RequireAuth` (nuevo, `src/auth/RequireAuth.tsx`) envuelve `element: <AppShell />` en `router.tsx`; nueva ruta `/login` fuera de la guarda con `LoginPage.tsx`. Botón "Cerrar sesión" al pie de la barra lateral de `AppShell.tsx`.
- **apps/mobile**: `RootNavigator` monta `LoginScreen` o el árbol de Tabs/Stack existente según `session` (sin guardas por pantalla individual, research.md §8). Botón de cerrar sesión en el header de `ClientDirectoryScreen` (única superficie nueva de UI para esto en móvil — no existe una pantalla de ajustes propia, a diferencia de `SettingsPage` en web).
