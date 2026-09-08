import type { ClientScore } from '@repo/core';
import { useQueries } from '@tanstack/react-query';
import { clientRepository, loanRepository } from '../data/repositories';

export interface ClientDirectoryExtra {
  score: ClientScore | undefined;
  /** Cantidad de préstamos históricos (activos, liquidados o cancelados) — usado para KPI de
   * reincidencia (specs/006-rebrand-currency-polish/, US5). */
  loanCount: number | undefined;
}

/**
 * Datos adicionales del directorio que el mockup 2e pide por fila (score/comportamiento) y en
 * los KPIs agregados (tasa de reincidencia), pero que `IClientReader.list()` no trae por
 * defecto para no encarecer la consulta principal. Una consulta por cliente vía `useQueries` es
 * aceptable aquí porque la cartera es pequeña por diseño (research.md de specs/002-admin-web/,
 * mismo criterio que ya descartó paginación/virtualización de tablas).
 */
export function useClientDirectoryExtras(clientIds: string[]): Record<string, ClientDirectoryExtra> {
  const scoreQueries = useQueries({
    queries: clientIds.map((id) => ({
      queryKey: ['clientScore', id],
      queryFn: () => clientRepository.getScore(id),
    })),
  });

  const loanQueries = useQueries({
    queries: clientIds.map((id) => ({
      queryKey: ['clientLoanCount', id],
      queryFn: () => loanRepository.listByClient(id),
    })),
  });

  const result: Record<string, ClientDirectoryExtra> = {};
  clientIds.forEach((id, index) => {
    result[id] = {
      score: scoreQueries[index]?.data,
      loanCount: loanQueries[index]?.data?.length,
    };
  });
  return result;
}
