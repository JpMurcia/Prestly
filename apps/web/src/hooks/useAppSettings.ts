import type { CurrencyCode, PrincipalContributionMode } from '@repo/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { appSettingsRepository } from '../data/repositories';

/** Configuración global de la instalación — moneda (specs/006-rebrand-currency-polish/, US1) y
 * modo de abono a capital (specs/008-flexible-repayment-features/, US2, research.md D6).
 * apps/web es la única superficie que puede cambiarlas; apps/mobile solo las lee. */
export function useAppSettings() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['appSettings'],
    queryFn: () => appSettingsRepository.getSettings(),
  });

  const mutation = useMutation({
    mutationFn: (currency: CurrencyCode) => appSettingsRepository.updateCurrency(currency),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['appSettings'] }),
  });

  const principalContributionModeMutation = useMutation({
    mutationFn: (mode: PrincipalContributionMode) => appSettingsRepository.updatePrincipalContributionMode(mode),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['appSettings'] }),
  });

  return {
    currency: query.data?.currency ?? 'COP',
    principalContributionMode: query.data?.principalContributionMode ?? 'reduce_term',
    isLoading: query.isLoading,
    updateCurrency: mutation.mutate,
    isUpdating: mutation.isPending,
    updatePrincipalContributionMode: principalContributionModeMutation.mutate,
    isUpdatingPrincipalContributionMode: principalContributionModeMutation.isPending,
  };
}
