import { useQuery } from '@tanstack/react-query';
import { loanRepository } from '../data/repositories';

/** Todos los préstamos activos, buscables (spec.md, US2, FR-002). */
export function useActiveLoans() {
  return useQuery({
    queryKey: ['activeLoans'],
    queryFn: () => loanRepository.listActive(),
  });
}
