import { useMutation, useQueryClient } from '@tanstack/react-query';
import { loanRepository } from '../data/repositories';

/** Liquidar anticipadamente un préstamo completo (specs/003-operational-management/, US2). */
export function usePayoffLoan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (loanId: string) => loanRepository.payoffLoan(loanId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolioSummary'] });
      queryClient.invalidateQueries({ queryKey: ['portfolioTrend'] });
      queryClient.invalidateQueries({ queryKey: ['activeLoans'] });
      queryClient.invalidateQueries({ queryKey: ['loan'] });
      queryClient.invalidateQueries({ queryKey: ['clientDirectory'] });
      queryClient.invalidateQueries({ queryKey: ['clientDetail'] });
    },
  });
}
