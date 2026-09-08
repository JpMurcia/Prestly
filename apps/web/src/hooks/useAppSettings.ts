import type { CurrencyCode } from '@repo/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { appSettingsRepository } from '../data/repositories';

/** Configuración global de la instalación — hoy solo moneda (specs/006-rebrand-currency-polish/,
 * US1). apps/web es la única superficie que puede cambiarla; apps/mobile solo la lee. */
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

  return {
    currency: query.data?.currency ?? 'COP',
    isLoading: query.isLoading,
    updateCurrency: mutation.mutate,
    isUpdating: mutation.isPending,
  };
}
