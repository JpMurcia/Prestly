import { formatMoney } from '@repo/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { QuoteCalculatorPage } from '../src/pages/QuoteCalculatorPage';

// COP es la moneda por defecto (specs/006-rebrand-currency-polish/, US1). El normalizador de
// @testing-library/dom colapsa el U+00A0 de Intl a un espacio normal antes de comparar.
const cop = (n: number) => formatMoney(n, 'COP').replace(/\s/g, ' ');

vi.mock('../src/data/repositories', () => ({
  clientRepository: { findByPhone: vi.fn(), create: vi.fn(), findById: vi.fn() },
  loanRepository: { save: vi.fn() },
}));

import { clientRepository, loanRepository } from '../src/data/repositories';

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <QuoteCalculatorPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('QuoteCalculatorPage', () => {
  it('cotiza $500/15%/12 semanas con los mismos resultados que la app móvil (spec.md, US4, escenario 1)', () => {
    renderPage();

    // valores por defecto del formulario ya son el caso de referencia del spec.md raíz §5.1
    // (la cuota redondeada a COP aparece en el resumen Y en cada fila de la tabla completa)
    expect(screen.getAllByText(cop(47.92)).length).toBeGreaterThan(0);
    expect(screen.getByText(cop(575))).toBeInTheDocument();
  });

  it('emite el préstamo para un cliente nuevo (spec.md, US4, escenario 2)', async () => {
    vi.mocked(clientRepository.findByPhone).mockResolvedValue(null);
    vi.mocked(clientRepository.create).mockResolvedValue({
      id: 'c-new',
      name: 'Cliente Nuevo',
      phone: '8095551234',
      createdAt: new Date(),
    });
    // Consultado tras emitir para el botón "Compartir tabla por WhatsApp"
    // (specs/004-whatsapp-automation/, Historia 3).
    vi.mocked(clientRepository.findById).mockResolvedValue({
      id: 'c-new',
      name: 'Cliente Nuevo',
      phone: '8095551234',
      createdAt: new Date(),
    });
    vi.mocked(loanRepository.save).mockResolvedValue({
      id: 'p-new',
      clientId: 'c-new',
      principal: 500,
      interestRate: 0.15,
      strategy: 'flatFixedInstallment',
      installmentCount: 12,
      frequency: 'weekly',
      issueDate: new Date(),
      status: 'active',
      installments: [],
      createdAt: new Date(),
    });

    renderPage();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/nombre/i), 'Cliente Nuevo');
    await user.type(screen.getByLabelText(/tel[eé]fono/i), '8095551234');
    await user.click(screen.getByRole('button', { name: /emitir este préstamo/i }));

    await screen.findByText(/préstamo emitido/i);
    expect(loanRepository.save).toHaveBeenCalled();

    // specs/004-whatsapp-automation/, Historia 3: enlace wa.me listo apenas se emite, sin
    // ninguna acción adicional del usuario.
    const shareLink = await screen.findByTestId('whatsapp-share-loan');
    expect(shareLink).toHaveAttribute('href', expect.stringContaining('https://wa.me/8095551234'));
  });
});
