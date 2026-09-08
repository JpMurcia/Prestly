import { useMutation, useQueryClient } from '@tanstack/react-query';
import { clientRepository } from '../data/repositories';

/** Editar notas privadas de un cliente desde la página de Perfil completo
 * (specs/006-rebrand-currency-polish/, US5) — mismo patrón que apps/mobile. */
export function useUpdateClientNotes(clientId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (privateNotes: string) => clientRepository.update(clientId, { privateNotes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientDetail', clientId] });
      queryClient.invalidateQueries({ queryKey: ['clientDirectory'] });
    },
  });
}
