import { useQuery } from '@tanstack/react-query';
import { portfolioReader } from '../data/repositories';

/** Serie mensual de tendencia de cartera (specs/003-operational-management/, US3, FR-008). */
export function usePortfolioTrend() {
  return useQuery({
    queryKey: ['portfolioTrend'],
    queryFn: () => portfolioReader.getTrend(),
  });
}
