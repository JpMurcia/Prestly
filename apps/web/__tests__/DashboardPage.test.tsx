import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DashboardPage } from '../src/pages/DashboardPage';

vi.mock('../src/data/repositories', () => ({
  portfolioReader: { getSummary: vi.fn() },
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

    renderWithClient(<DashboardPage />);

    await waitFor(() => expect(screen.getByText('$500.00')).toBeInTheDocument());
    expect(screen.getByText('$0.00')).toBeInTheDocument();
  });
});
