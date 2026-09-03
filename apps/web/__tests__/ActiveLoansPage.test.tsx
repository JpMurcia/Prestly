import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ActiveLoansPage } from '../src/pages/ActiveLoansPage';

vi.mock('../src/data/repositories', () => ({
  loanRepository: { listActive: vi.fn() },
}));

import { loanRepository } from '../src/data/repositories';

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ActiveLoansPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const LOAN_SUMMARY = {
  loan: {
    id: 'p1',
    clientId: 'c1',
    principal: 500,
    interestRate: 0.15,
    strategy: 'flatFixedInstallment' as const,
    installmentCount: 12,
    frequency: 'weekly' as const,
    issueDate: new Date('2026-01-01'),
    status: 'active' as const,
    installments: [],
    createdAt: new Date('2026-01-01'),
  },
  client: { id: 'c1', name: 'Rosa Delgado', phone: '+1 809 555 0142' },
};

describe('ActiveLoansPage', () => {
  it('lista los préstamos activos y permite buscar por cliente (spec.md, US2, escenario 1)', async () => {
    vi.mocked(loanRepository.listActive).mockResolvedValue([LOAN_SUMMARY]);

    renderPage();

    expect(await screen.findByText('Rosa Delgado')).toBeInTheDocument();
  });

  it('muestra un estado vacío cuando no hay préstamos activos (spec.md, US2, escenario 5)', async () => {
    vi.mocked(loanRepository.listActive).mockResolvedValue([]);

    renderPage();

    expect(await screen.findByText(/no tienes préstamos activos/i)).toBeInTheDocument();
  });
});
