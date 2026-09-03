import { useQuery } from '@tanstack/react-query';

import { clientRepository, loanRepository } from '../data/repositories';
import { queryKeys } from './queryKeys';

/** Perfil 360° (US4): cliente + score + historial de préstamos, en una sola consulta. */
export function useClientProfile(clientId: string) {
  return useQuery({
    queryKey: queryKeys.clientProfile(clientId),
    queryFn: async () => {
      const [client, score, loans] = await Promise.all([
        clientRepository.findById(clientId),
        clientRepository.getScore(clientId),
        loanRepository.listByClient(clientId),
      ]);
      if (!client) throw new Error(`Cliente ${clientId} no encontrado`);
      return { client, score, loans };
    },
  });
}
