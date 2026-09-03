import { useMutation, useQueryClient } from '@tanstack/react-query';
import { issueLoan, type IssueLoanInput } from '@repo/core';

import { clientRepository, loanRepository } from '../data/repositories';
import { queryKeys } from './queryKeys';

/** Mutación de emisión (US1, FR-004) — invalida ruta de cobranza y directorio (FR-009). */
export function useIssueLoan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: IssueLoanInput) =>
      issueLoan(input, { clientReader: clientRepository, clientWriter: clientRepository, loanRepository }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.collectionRoute });
      queryClient.invalidateQueries({ queryKey: ['clientDirectory'] });
    },
  });
}
