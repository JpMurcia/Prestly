import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DashboardPage } from '../src/pages/DashboardPage';

vi.mock('../src/data/repositories', () => ({
  portfolioReader: { getSummary: vi.fn(), getTrend: vi.fn() },
}));

import { portfolioReader } from '../src/data/repositories';

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('DashboardPage', () => {
  it('muestra las cuatro métricas de cartera (spec.md, US1, escenario 1)', async () => {
    vi.mocked(portfolioReader.getSummary).mockResolvedValue({
      principalLent: 18450,
      totalRecovered: 13820,
      interestEarned: 2767,
      overdueAmount: 865,
      overdueInstallments: 4,
      overdueClients: 3,
    });
    vi.mocked(portfolioReader.getTrend).mockResolvedValue([]);

    renderWithClient(<DashboardPage />);

    expect(await screen.findByText('$18,450.00')).toBeInTheDocument();
    expect(screen.getByText('$13,820.00')).toBeInTheDocument();
    expect(screen.getByText('$2,767.00')).toBeInTheDocument();
    expect(screen.getByText('$865.00')).toBeInTheDocument();
  });

  it('muestra $0 en cartera en mora cuando no hay cuotas vencidas (edge case de spec.md)', async () => {
    vi.mocked(portfolioReader.getSummary).mockResolvedValue({
      principalLent: 500,
      totalRecovered: 47.92,
      interestEarned: 6.25,
      overdueAmount: 0,
      overdueInstallments: 0,
      overdueClients: 0,
    });
    vi.mocked(portfolioReader.getTrend).mockResolvedValue([]);

    renderWithClient(<DashboardPage />);

    await waitFor(() => expect(screen.getByText('$500.00')).toBeInTheDocument());
    expect(screen.getByText('$0.00')).toBeInTheDocument();
  });

  it('con menos de 2 meses de historial muestra el estado de "historial limitado", no una gráfica (specs/003-operational-management/, US3, escenario 2)', async () => {
    vi.mocked(portfolioReader.getSummary).mockResolvedValue({
      principalLent: 500,
      totalRecovered: 0,
      interestEarned: 0,
      overdueAmount: 0,
      overdueInstallments: 0,
      overdueClients: 0,
    });
    vi.mocked(portfolioReader.getTrend).mockResolvedValue([
      { period: '2026-09', principalLent: 500, totalRecovered: 0, interestEarned: 0 },
    ]);

    renderWithClient(<DashboardPage />);

    await waitFor(() => expect(screen.getByTestId('trend-limited-history')).toBeInTheDocument());
    expect(screen.queryByTestId('trend-chart')).not.toBeInTheDocument();
  });

  it('con ≥2 meses de historial muestra la gráfica de tendencia (specs/003-operational-management/, US3, escenario 1)', async () => {
    vi.mocked(portfolioReader.getSummary).mockResolvedValue({
      principalLent: 1500,
      totalRecovered: 47.92,
      interestEarned: 6.25,
      overdueAmount: 0,
      overdueInstallments: 0,
      overdueClients: 0,
    });
    vi.mocked(portfolioReader.getTrend).mockResolvedValue([
      { period: '2026-08', principalLent: 1000, totalRecovered: 0, interestEarned: 0 },
      { period: '2026-09', principalLent: 500, totalRecovered: 47.92, interestEarned: 6.25 },
    ]);

    renderWithClient(<DashboardPage />);

    await waitFor(() => expect(screen.getByTestId('trend-chart')).toBeInTheDocument());
    expect(screen.queryByTestId('trend-limited-history')).not.toBeInTheDocument();
  });
});
