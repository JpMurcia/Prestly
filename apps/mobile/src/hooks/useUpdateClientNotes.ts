import { useMutation, useQueryClient } from '@tanstack/react-query';

import { clientRepository } from '../data/repositories';
import { queryKeys } from './queryKeys';

/** Editar notas privadas de un cliente (US4, FR-012). */
export function useUpdateClientNotes(clientId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (privateNotes: string) => clientRepository.update(clientId, { privateNotes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clientProfile(clientId) });
      queryClient.invalidateQueries({ queryKey: ['clientDirectory'] });
    },
  });
}
