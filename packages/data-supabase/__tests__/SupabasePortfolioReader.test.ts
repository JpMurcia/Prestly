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

  it('getTrend mapea las filas de `cartera_tendencia_mensual` a PortfolioTrendPoint[] (specs/003-operational-management, US3)', async () => {
    const rows = [
      { periodo: '2026-08-01', capital_prestado: 1000, total_recuperado: 200, intereses_ganados: 30 },
      { periodo: '2026-09-01', capital_prestado: 500, total_recuperado: 47.92, intereses_ganados: 6.25 },
    ];
    const supabase = fakeSupabase({ data: rows, error: null });
    const reader = new SupabasePortfolioReader(supabase as never);

    const trend = await reader.getTrend();

    expect(trend).toEqual([
      { period: '2026-08', principalLent: 1000, totalRecovered: 200, interestEarned: 30 },
      { period: '2026-09', principalLent: 500, totalRecovered: 47.92, interestEarned: 6.25 },
    ]);
  });

  it('getTrend con cartera sin actividad devuelve un arreglo vacío, no un error (edge case de spec.md)', async () => {
    const supabase = fakeSupabase({ data: [], error: null });
    const reader = new SupabasePortfolioReader(supabase as never);

    const trend = await reader.getTrend();

    expect(trend).toEqual([]);
  });
});
