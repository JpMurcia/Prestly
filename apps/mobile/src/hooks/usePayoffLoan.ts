import { useMutation, useQueryClient } from '@tanstack/react-query';

import { loanRepository } from '../data/repositories';
import { queryKeys } from './queryKeys';

/** Liquidar anticipadamente un préstamo completo (specs/003-operational-management/, US2). */
export function usePayoffLoan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (loanId: string) => loanRepository.payoffLoan(loanId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.collectionRoute });
      queryClient.invalidateQueries({ queryKey: ['clientDirectory'] });
      queryClient.invalidateQueries({ queryKey: ['clientProfile'] });
      queryClient.invalidateQueries({ queryKey: ['loan'] });
    },
  });
}
