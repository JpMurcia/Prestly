import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createSupabaseClient,
  SupabaseAppSettingsRepository,
  SupabaseAuthRepository,
  SupabaseClientRepository,
  SupabaseLoanRepository,
} from '@repo/data-supabase';

/**
 * Único punto de la app que importa @repo/data-supabase directamente (regla DIP de
 * specs/001-mobile-field-app/contracts/core-interfaces.md) — todo lo demás pasa por
 * ILoanRepository/IClientReader/IClientWriter. Las clases concretas (y su guarda de
 * concurrencia) se comparten con apps/web desde specs/002-admin-web/ — ver su research.md §6.
 * `authStorage: AsyncStorage` (specs/007-admin-authentication/, research.md §3) — no hay
 * `localStorage` en React Native, así que la sesión persiste en el almacenamiento nativo.
 */
const supabase = createSupabaseClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  { authStorage: AsyncStorage }
);

/** Instancias únicas — inyectadas en los use-cases de @repo/core desde los hooks. */
export const clientRepository = new SupabaseClientRepository(supabase);
export const loanRepository = new SupabaseLoanRepository(supabase);
/** Solo lectura desde mobile (specs/006-rebrand-currency-polish/, plan.md) — la moneda se
 * configura únicamente desde apps/web. */
export const appSettingsRepository = new SupabaseAppSettingsRepository(supabase);
export const authRepository = new SupabaseAuthRepository(supabase);
