import {
  createSupabaseClient,
  SupabaseAppSettingsRepository,
  SupabaseClientRepository,
  SupabaseLoanRepository,
  SupabasePortfolioReader,
  SupabaseWhatsAppConfigRepository,
  SupabaseWhatsAppNotificationHistoryReader,
} from '@repo/data-supabase';

/**
 * Único punto de apps/web que importa @repo/data-supabase directamente (regla DIP de
 * contracts/core-interfaces.md) — todo lo demás pasa por
 * ILoanRepository/IClientReader/IPortfolioReader. Mismas clases (y guarda de concurrencia)
 * que usa apps/mobile — ver research.md §6 de specs/002-admin-web/.
 */
const supabase = createSupabaseClient(
  import.meta.env.VITE_SUPABASE_URL ?? '',
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''
);

/** Instancias únicas — inyectadas en los hooks de apps/web. */
export const clientRepository = new SupabaseClientRepository(supabase);
export const loanRepository = new SupabaseLoanRepository(supabase);
export const portfolioReader = new SupabasePortfolioReader(supabase);
export const whatsAppConfigRepository = new SupabaseWhatsAppConfigRepository(supabase);
export const whatsAppNotificationHistoryReader = new SupabaseWhatsAppNotificationHistoryReader(supabase);
export const appSettingsRepository = new SupabaseAppSettingsRepository(supabase);
