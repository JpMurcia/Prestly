import { createClient } from '@supabase/supabase-js';

/**
 * Único punto de la app que importa @supabase/supabase-js directamente (regla DIP de
 * specs/001-mobile-field-app/contracts/core-interfaces.md) — todo lo demás pasa por
 * ILoanRepository/IClientReader/IClientWriter.
 */
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Faltan EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Copiá apps/mobile/.env.example a apps/mobile/.env.local (ver ese archivo).'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
  },
});
