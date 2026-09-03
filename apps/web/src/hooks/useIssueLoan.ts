import { issueLoan, type IssueLoanInput } from '@repo/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { clientRepository, loanRepository } from '../data/repositories';

/** Emitir un préstamo desde la cotización de la calculadora (spec.md, US4, FR-008) —
 * mismo caso de uso `issueLoan` de `@repo/core` que usa la app móvil, ninguna fórmula
 * ni flujo se reimplementa aquí (Principio II de la constitución). */
export function useIssueLoan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: IssueLoanInput) =>
      issueLoan(input, {
        clientReader: clientRepository,
        clientWriter: clientRepository,
        loanRepository,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolioSummary'] });
      queryClient.invalidateQueries({ queryKey: ['activeLoans'] });
      queryClient.invalidateQueries({ queryKey: ['clientDirectory'] });
    },
  });
}
