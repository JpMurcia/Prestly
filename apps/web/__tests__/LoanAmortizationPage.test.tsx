import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { LoanAmortizationPage } from '../src/pages/LoanAmortizationPage';

vi.mock('../src/data/repositories', () => ({
  loanRepository: { findById: vi.fn(), registerInstallmentPayment: vi.fn(), payoffLoan: vi.fn() },
  // Consultado para el botón "Enviar comprobante por WhatsApp" de cuotas pagadas/parciales
  // (specs/004-whatsapp-automation/, Historia 3).
  clientRepository: { findById: vi.fn() },
}));

import { clientRepository, loanRepository } from '../src/data/repositories';

const CLIENT = { id: 'c1', name: 'Cliente Uno', phone: '8095551234', createdAt: new Date('2026-01-01') };

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
    vi.mocked(clientRepository.findById).mockResolvedValue(CLIENT);

    renderPage();

    // las 2 cuotas del préstamo de prueba tienen la misma cuota ($47.92)
    expect(await screen.findAllByText('$47.92')).toHaveLength(2);
    // encabezado — capital del préstamo
    expect(screen.getByText('$500.00', { exact: false })).toBeInTheDocument();
  });

  it('registrar el cobro completo de una cuota pendiente la marca como pagada de inmediato (spec.md US2 esc. 3 de specs/002-admin-web/)', async () => {
    vi.mocked(loanRepository.findById).mockResolvedValue(LOAN);
    vi.mocked(clientRepository.findById).mockResolvedValue(CLIENT);
    vi.mocked(loanRepository.registerInstallmentPayment).mockResolvedValue({
      ...LOAN.installments[1]!,
      status: 'paid',
      paidAt: new Date('2026-01-15'),
      paidAmount: 47.92,
    });

    renderPage();

    const user = userEvent.setup();
    const registerButton = await screen.findByRole('button', { name: /registrar/i });
    // El input de monto ya viene precargado con el saldo restante completo — un clic directo
    // registra un pago total, igual comportamiento que antes de specs/003-operational-management/.
    await user.click(registerButton);

    await waitFor(() => expect(loanRepository.registerInstallmentPayment).toHaveBeenCalledWith('cu2', 47.92));
  });

  it('registrar un monto menor al saldo restante registra un pago parcial (specs/003-operational-management/, US1, escenario 1)', async () => {
    vi.mocked(loanRepository.findById).mockResolvedValue(LOAN);
    vi.mocked(clientRepository.findById).mockResolvedValue(CLIENT);
    vi.mocked(loanRepository.registerInstallmentPayment).mockResolvedValue({
      ...LOAN.installments[1]!,
      status: 'partial',
      paidAmount: 20,
    });

    renderPage();

    const user = userEvent.setup();
    const amountInput = await screen.findByLabelText(/monto a registrar para la cuota 2/i);
    await user.clear(amountInput);
    await user.type(amountInput, '20');

    const registerButton = screen.getByRole('button', { name: /registrar/i });
    await user.click(registerButton);

    await waitFor(() => expect(loanRepository.registerInstallmentPayment).toHaveBeenCalledWith('cu2', 20));
  });

  it('tras un pago parcial, el input vuelve a precargarse con el NUEVO saldo restante en vez de reenviar el monto anterior (regresión encontrada en verificación manual)', async () => {
    vi.mocked(loanRepository.findById)
      .mockResolvedValueOnce(LOAN)
      .mockResolvedValue({
        ...LOAN,
        installments: [LOAN.installments[0]!, { ...LOAN.installments[1]!, status: 'partial' as const, paidAmount: 20 }],
      });
    vi.mocked(clientRepository.findById).mockResolvedValue(CLIENT);
    vi.mocked(loanRepository.registerInstallmentPayment).mockResolvedValue({
      ...LOAN.installments[1]!,
      status: 'partial',
      paidAmount: 20,
    });

    renderPage();

    const user = userEvent.setup();
    const amountInput = await screen.findByLabelText(/monto a registrar para la cuota 2/i);
    await user.clear(amountInput);
    await user.type(amountInput, '20');
    await user.click(screen.getByRole('button', { name: /registrar/i }));

    await waitFor(() => expect(loanRepository.registerInstallmentPayment).toHaveBeenCalledWith('cu2', 20));

    // Tras refrescar (saldo restante ahora $27.92), el input debe mostrar ese nuevo saldo —
    // no seguir mostrando "20" (el bug: reenviaría el mismo monto en vez del saldo actual).
    await waitFor(() => expect(screen.getByLabelText(/monto a registrar para la cuota 2/i)).toHaveValue(27.92));
  });

  it('liquidar anticipadamente muestra el saldo restante antes de confirmar y luego liquida el préstamo (specs/003-operational-management/, US2)', async () => {
    vi.mocked(loanRepository.findById).mockResolvedValue(LOAN);
    vi.mocked(clientRepository.findById).mockResolvedValue(CLIENT);
    vi.mocked(loanRepository.payoffLoan).mockResolvedValue({ ...LOAN, status: 'settled' });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderPage();

    const user = userEvent.setup();
    // El saldo restante del préstamo de prueba es solo el de la cuota 2 (la 1 ya está pagada).
    const payoffButton = await screen.findByRole('button', { name: /liquidar anticipadamente \(\$47\.92\)/i });
    await user.click(payoffButton);

    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('$47.92'));
    await waitFor(() => expect(loanRepository.payoffLoan).toHaveBeenCalledWith('p1'));

    confirmSpy.mockRestore();
  });

  it('una cuota ya pagada muestra un enlace de WhatsApp con el comprobante correcto (specs/004-whatsapp-automation/, Historia 3)', async () => {
    vi.mocked(loanRepository.findById).mockResolvedValue(LOAN);
    vi.mocked(clientRepository.findById).mockResolvedValue(CLIENT);

    renderPage();

    await screen.findByTestId('whatsapp-receipt-1');
    // El teléfono del cliente llega en una segunda consulta encadenada tras cargar el
    // préstamo — el href se completa un instante después de que el botón ya existe.
    await waitFor(() => expect(screen.getByTestId('whatsapp-receipt-1')).toHaveAttribute('href'));
    const link = screen.getByTestId('whatsapp-receipt-1');
    expect(link).toHaveAttribute('href', expect.stringContaining('https://wa.me/8095551234'));
    expect(decodeURIComponent(link.getAttribute('href') ?? '')).toContain('pagada por completo');
  });

  it('un cliente sin teléfono utilizable deja el enlace de WhatsApp deshabilitado, sin href (FR-010)', async () => {
    vi.mocked(loanRepository.findById).mockResolvedValue(LOAN);
    vi.mocked(clientRepository.findById).mockResolvedValue({ ...CLIENT, phone: 'n/a' });

    renderPage();

    const link = await screen.findByTestId('whatsapp-receipt-1');
    expect(link).toHaveAttribute('aria-disabled', 'true');
    expect(link).not.toHaveAttribute('href');
  });
});
