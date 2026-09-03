import type { IPortfolioReader, PortfolioSummary } from '@repo/core';
import type { SupabaseClient } from '@supabase/supabase-js';

interface CarteraResumenRow {
  capital_prestado: number;
  total_recuperado: number;
  intereses_ganados: number;
  cartera_en_mora: number;
  cuotas_en_mora: number;
  clientes_en_mora: number;
}

const VACIO: CarteraResumenRow = {
  capital_prestado: 0,
  total_recuperado: 0,
  intereses_ganados: 0,
  cartera_en_mora: 0,
  cuotas_en_mora: 0,
  clientes_en_mora: 0,
};

function toPortfolioSummary(row: CarteraResumenRow): PortfolioSummary {
  return {
    principalLent: row.capital_prestado,
    totalRecovered: row.total_recuperado,
    interestEarned: row.intereses_ganados,
    overdueAmount: row.cartera_en_mora,
    overdueInstallments: row.cuotas_en_mora,
    overdueClients: row.clientes_en_mora,
  };
}

/** Implementación concreta de IPortfolioReader contra `VIEW cartera_resumen`
 * (specs/002-admin-web/data-model.md) — fila única, sin filtros. */
export class SupabasePortfolioReader implements IPortfolioReader {
  private readonly supabase: SupabaseClient;

  // Asignación explícita — ver el mismo comentario en SupabaseClientRepository.ts.
  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  async getSummary(): Promise<PortfolioSummary> {
    const { data, error } = await this.supabase
      .from('cartera_resumen')
      .select('capital_prestado, total_recuperado, intereses_ganados, cartera_en_mora, cuotas_en_mora, clientes_en_mora')
      .maybeSingle<CarteraResumenRow>();

    if (error) throw error;
    return toPortfolioSummary(data ?? VACIO);
  }
}
