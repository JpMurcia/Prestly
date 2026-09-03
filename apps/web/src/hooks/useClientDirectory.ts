import type { ClientFilter } from '@repo/core';
import { useQuery } from '@tanstack/react-query';
import { clientRepository } from '../data/repositories';

/** Directorio de clientes buscable/filtrable (spec.md, US3, FR-005). */
export function useClientDirectory(filter: ClientFilter) {
  return useQuery({
    queryKey: ['clientDirectory', filter],
    queryFn: () => clientRepository.list(filter),
  });
}
