import { useMutation, useQueryClient } from '@tanstack/react-query';
import { loanRepository } from '../data/repositories';

export interface RegisterPaymentVars {
  installmentId: string;
  /** Monto a aplicar — el saldo restante completo para un pago total, o menos para un pago
   * parcial (specs/003-operational-management/, US1). */
  amount: number;
}

/** Registrar el cobro de una cuota, total o parcial — compartido entre "Préstamos activos"
 * (US2 de specs/002-admin-web/) y el panel de detalle del directorio (US3); invalida todo lo
 * que puede mostrar su resultado, incluida la tendencia (specs/003-operational-management/). */
export function useRegisterPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ installmentId, amount }: RegisterPaymentVars) =>
      loanRepository.registerInstallmentPayment(installmentId, amount),
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
