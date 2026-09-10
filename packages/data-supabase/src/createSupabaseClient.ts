import { createClient, type SupabaseClient, type SupportedStorage } from '@supabase/supabase-js';

export interface CreateSupabaseClientOptions {
  /** Adaptador de persistencia de sesión (specs/007-admin-authentication/, research.md §3).
   * apps/web lo omite — supabase-js usa `window.localStorage` por defecto en un navegador.
   * apps/mobile pasa `AsyncStorage` (no hay `localStorage` en React Native). */
  authStorage?: SupportedStorage;
}

/**
 * Factoría compartida por apps/mobile y apps/web — recibe url/anonKey explícitos en vez de
 * leer variables de entorno (cada app tiene su propia convención: EXPO_PUBLIC_* en móvil,
 * VITE_* en web), ver specs/002-admin-web/research.md §6.
 */
export function createSupabaseClient(
  url: string,
  anonKey: string,
  options?: CreateSupabaseClientOptions
): SupabaseClient {
  if (!url || !anonKey) {
    throw new Error(
      'createSupabaseClient: faltan url/anonKey. Cada app provee sus propias credenciales ' +
        '(ver su .env.example) antes de instanciar los repositorios.'
    );
  }

  return createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storage: options?.authStorage,
    },
  });
}
