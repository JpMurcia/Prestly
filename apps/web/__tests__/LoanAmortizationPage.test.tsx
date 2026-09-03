import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { LoanAmortizationPage } from '../src/pages/LoanAmortizationPage';

vi.mock('../src/data/repositories', () => ({
  loanRepository: { findById: vi.fn(), markInstallmentPaid: vi.fn() },
}));

import { loanRepository } from '../src/data/repositories';

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/prestamos/p1']}>
        <Routes>
          <Route path="/prestamos/:id" element={<LoanAmortizationPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const LOAN = {
  id: 'p1',
  clientId: 'c1',
  principal: 500,
  interestRate: 0.15,
  strategy: 'flatFixedInstallment' as const,
  installmentCount: 2,
  frequency: 'weekly' as const,
  issueDate: new Date('2026-01-01'),
  status: 'active' as const,
  createdAt: new Date('2026-01-01'),
  installments: [
    {
      id: 'cu1',
      number: 1,
      dueDate: new Date('2026-01-08'),
      principalPortion: 41.67,
      interestPortion: 6.25,
      totalAmount: 47.92,
      status: 'paid' as const,
      paidAt: new Date('2026-01-08'),
      paidAmount: 47.92,
    },
    {
      id: 'cu2',
      number: 2,
      dueDate: new Date('2026-01-15'),
      principalPortion: 41.67,
      interestPortion: 6.25,
      totalAmount: 47.92,
      status: 'pending' as const,
    },
  ],
};

describe('LoanAmortizationPage', () => {
  it('muestra la tabla completa con totales (spec.md, US2, escenario 2)', async () => {
    vi.mocked(loanRepository.findById).mockResolvedValue(LOAN);

    renderPage();

    // las 2 cuotas del préstamo de prueba tienen la misma cuota ($47.92)
    expect(await screen.findAllByText('$47.92')).toHaveLength(2);
    // encabezado — capital del préstamo
    expect(screen.getByText('$500.00', { exact: false })).toBeInTheDocument();
  });

  it('registrar el cobro de una cuota pendiente la marca como pagada de inmediato (spec.md, US2, escenario 3)', async () => {
    vi.mocked(loanRepository.findById).mockResolvedValue(LOAN);
    vi.mocked(loanRepository.markInstallmentPaid).mockResolvedValue({
      ...LOAN.installments[1]!,
      status: 'paid',
      paidAt: new Date('2026-01-15'),
      paidAmount: 47.92,
    });

    renderPage();

    const user = userEvent.setup();
    const registerButton = await screen.findByRole('button', { name: /registrar/i });
    await user.click(registerButton);

    await waitFor(() => expect(loanRepository.markInstallmentPaid).toHaveBeenCalledWith('cu2'));
  });
});
