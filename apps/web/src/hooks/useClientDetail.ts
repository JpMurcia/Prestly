import { useQuery } from '@tanstack/react-query';
import { clientRepository, loanRepository } from '../data/repositories';

/** Panel de detalle de un cliente (drawer) — combina cliente + score + historial de
 * préstamos, mismo patrón que ClientProfileScreen de apps/mobile (spec.md, US3, FR-006). */
export function useClientDetail(clientId: string | undefined) {
  return useQuery({
    queryKey: ['clientDetail', clientId],
    queryFn: async () => {
      const id = clientId as string;
      const [client, score, loans] = await Promise.all([
        clientRepository.findById(id),
        clientRepository.getScore(id),
        loanRepository.listByClient(id),
      ]);
      return { client, score, loans };
    },
    enabled: Boolean(clientId),
  });
}
