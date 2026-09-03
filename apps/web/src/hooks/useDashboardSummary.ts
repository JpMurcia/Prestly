import { useQuery } from '@tanstack/react-query';
import { portfolioReader } from '../data/repositories';

/** Resumen agregado de cartera para el dashboard (spec.md, US1, FR-001). */
export function useDashboardSummary() {
  return useQuery({
    queryKey: ['portfolioSummary'],
    queryFn: () => portfolioReader.getSummary(),
  });
}
