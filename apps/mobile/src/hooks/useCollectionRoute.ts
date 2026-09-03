import { useQuery } from '@tanstack/react-query';

import { loanRepository } from '../data/repositories';
import { queryKeys } from './queryKeys';

/** Ruta de cobranza diaria (US2, FR-007) — vencidas primero, luego las que vencen hoy. */
export function useCollectionRoute() {
  return useQuery({
    queryKey: queryKeys.collectionRoute,
    queryFn: () => loanRepository.listCollectionRoute(new Date()),
  });
}
