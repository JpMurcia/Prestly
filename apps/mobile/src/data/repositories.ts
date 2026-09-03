import { createSupabaseClient, SupabaseClientRepository, SupabaseLoanRepository } from '@repo/data-supabase';

/**
 * Único punto de la app que importa @repo/data-supabase directamente (regla DIP de
 * specs/001-mobile-field-app/contracts/core-interfaces.md) — todo lo demás pasa por
 * ILoanRepository/IClientReader/IClientWriter. Las clases concretas (y su guarda de
 * concurrencia) se comparten con apps/web desde specs/002-admin-web/ — ver su research.md §6.
 */
const supabase = createSupabaseClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ''
);

/** Instancias únicas — inyectadas en los use-cases de @repo/core desde los hooks. */
export const clientRepository = new SupabaseClientRepository(supabase);
export const loanRepository = new SupabaseLoanRepository(supabase);
