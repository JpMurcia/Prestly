import { useMutation, useQueryClient } from '@tanstack/react-query';
import { registerPayment } from '@repo/core';

import { loanRepository } from '../data/repositories';
import { queryKeys } from './queryKeys';

export interface RegisterPaymentVars {
  installmentId: string;
  installmentAmount: number;
  receivedAmount: number;
}

/** Confirmar un cobro (US2, FR-008/FR-009) — valida FR-014 antes de persistir, luego
 * invalida ruta de cobranza/directorio/perfil para reflejar el cambio de inmediato. */
export function useRegisterPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ installmentId, installmentAmount, receivedAmount }: RegisterPaymentVars) => {
      registerPayment(installmentAmount, receivedAmount); // valida FR-014; lanza si es parcial
      return loanRepository.markInstallmentPaid(installmentId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.collectionRoute });
      queryClient.invalidateQueries({ queryKey: ['clientDirectory'] });
      queryClient.invalidateQueries({ queryKey: ['clientProfile'] });
      queryClient.invalidateQueries({ queryKey: ['loan'] });
    },
  });
}
