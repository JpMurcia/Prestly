import { useQuery } from '@tanstack/react-query';

import { loanRepository } from '../data/repositories';
import { queryKeys } from './queryKeys';

/** Un préstamo con su cronograma completo — usado por LoanDetailScreen (Polish). */
export function useLoan(loanId: string) {
  return useQuery({
    queryKey: queryKeys.loan(loanId),
    queryFn: () => loanRepository.findById(loanId),
  });
}
