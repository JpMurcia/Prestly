import { SupabasePortfolioReader } from '../src/SupabasePortfolioReader';
import { fakeSupabase } from './testHelpers';

describe('SupabasePortfolioReader', () => {
  it('mapea la fila de `cartera_resumen` a PortfolioSummary (camelCase, specs/002-admin-web US1)', async () => {
    const row = {
      capital_prestado: 18450,
      total_recuperado: 13820,
      intereses_ganados: 2767,
      cartera_en_mora: 865,
      cuotas_en_mora: 4,
      clientes_en_mora: 3,
    };
    const supabase = fakeSupabase({ data: row, error: null });
    const reader = new SupabasePortfolioReader(supabase as never);

    const summary = await reader.getSummary();

    expect(summary).toEqual({
      principalLent: 18450,
      totalRecovered: 13820,
      interestEarned: 2767,
      overdueAmount: 865,
      overdueInstallments: 4,
      overdueClients: 3,
    });
  });

  it('cartera vacía (sin préstamos) devuelve ceros, no null/undefined (edge case de spec.md)', async () => {
    const row = {
      capital_prestado: 0,
      total_recuperado: 0,
      intereses_ganados: 0,
      cartera_en_mora: 0,
      cuotas_en_mora: 0,
      clientes_en_mora: 0,
    };
    const supabase = fakeSupabase({ data: row, error: null });
    const reader = new SupabasePortfolioReader(supabase as never);

    const summary = await reader.getSummary();

    expect(summary.overdueAmount).toBe(0);
    expect(summary.principalLent).toBe(0);
  });
});
