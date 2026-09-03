import { useQuery } from '@tanstack/react-query';
import type { ClientFilter } from '@repo/core';

import { clientRepository } from '../data/repositories';
import { queryKeys } from './queryKeys';

/** Directorio y cartera de clientes (US3, FR-005/FR-006). */
export function useClientDirectory(filter: ClientFilter) {
  return useQuery({
    queryKey: queryKeys.clientDirectory(filter),
    queryFn: () => clientRepository.list(filter),
  });
}
