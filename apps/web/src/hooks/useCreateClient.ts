import { createStandaloneClient, type NewClient } from '@repo/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { clientRepository } from '../data/repositories';

/** Alta de cliente sin préstamo (specs/006-rebrand-currency-polish/, US3) — botón "Nuevo
 * cliente" del directorio. Reutiliza la guarda anti-duplicado de teléfono de `@repo/core`
 * (`createStandaloneClient`), que a diferencia de la de `issueLoan` RECHAZA el duplicado en
 * vez de reutilizarlo en silencio (spec FR-007). */
export function useCreateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: NewClient) =>
      createStandaloneClient(data, { clientReader: clientRepository, clientWriter: clientRepository }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clientDirectory'] }),
  });
}
