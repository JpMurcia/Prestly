import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Factoría compartida por apps/mobile y apps/web — recibe url/anonKey explícitos en vez de
 * leer variables de entorno (cada app tiene su propia convención: EXPO_PUBLIC_* en móvil,
 * VITE_* en web), ver specs/002-admin-web/research.md §6.
 */
export function createSupabaseClient(url: string, anonKey: string): SupabaseClient {
  if (!url || !anonKey) {
    throw new Error(
      'createSupabaseClient: faltan url/anonKey. Cada app provee sus propias credenciales ' +
        '(ver su .env.example) antes de instanciar los repositorios.'
    );
  }

  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
    },
  });
}
