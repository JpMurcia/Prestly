import { useMutation, useQueryClient } from '@tanstack/react-query';
import { loanRepository } from '../data/repositories';

/** Registrar el cobro de una cuota — compartido entre "Préstamos activos" (US2) y el
 * panel de detalle del directorio (US3); invalida todo lo que puede mostrar su resultado
 * (spec.md, US2, escenario 3: "de inmediato"). */
export function useRegisterPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (installmentId: string) => loanRepository.markInstallmentPaid(installmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolioSummary'] });
      queryClient.invalidateQueries({ queryKey: ['activeLoans'] });
      queryClient.invalidateQueries({ queryKey: ['loan'] });
      queryClient.invalidateQueries({ queryKey: ['clientDirectory'] });
      queryClient.invalidateQueries({ queryKey: ['clientDetail'] });
    },
  });
}
