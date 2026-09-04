import { useMutation, useQueryClient } from '@tanstack/react-query';

import { loanRepository } from '../data/repositories';
import { queryKeys } from './queryKeys';

export interface RegisterPaymentVars {
  installmentId: string;
  /** Monto a aplicar — el saldo restante completo para un pago total, o menos para un pago
   * parcial (specs/003-operational-management/, US1). El llamador (RegisterPaymentModal) ya
   * lo calculó con `registerPayment` de `@repo/core` (capado al saldo restante). */
  amount: number;
}

/** Confirmar un cobro, total o parcial (specs/003-operational-management/, US1) — luego
 * invalida ruta de cobranza/directorio/perfil para reflejar el cambio de inmediato. */
export function useRegisterPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ installmentId, amount }: RegisterPaymentVars) =>
      loanRepository.registerInstallmentPayment(installmentId, amount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.collectionRoute });
      queryClient.invalidateQueries({ queryKey: ['clientDirectory'] });
      queryClient.invalidateQueries({ queryKey: ['clientProfile'] });
      queryClient.invalidateQueries({ queryKey: ['loan'] });
    },
  });
}
