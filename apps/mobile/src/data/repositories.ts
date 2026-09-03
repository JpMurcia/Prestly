import { SupabaseClientRepository } from './SupabaseClientRepository';
import { SupabaseLoanRepository } from './SupabaseLoanRepository';

/** Instancias únicas — inyectadas en los use-cases de @repo/core desde los hooks. */
export const clientRepository = new SupabaseClientRepository();
export const loanRepository = new SupabaseLoanRepository();
