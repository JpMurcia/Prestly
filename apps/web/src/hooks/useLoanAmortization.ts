import { useQuery } from '@tanstack/react-query';
import { loanRepository } from '../data/repositories';

/** Tabla de amortización completa de un préstamo (spec.md, US2, FR-003). */
export function useLoanAmortization(loanId: string | undefined) {
  return useQuery({
    queryKey: ['loan', loanId],
    queryFn: () => loanRepository.findById(loanId as string),
    enabled: Boolean(loanId),
  });
}
