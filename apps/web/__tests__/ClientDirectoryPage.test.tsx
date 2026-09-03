import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ClientDirectoryPage } from '../src/pages/ClientDirectoryPage';

vi.mock('../src/data/repositories', () => ({
  clientRepository: { list: vi.fn(), findById: vi.fn(), getScore: vi.fn() },
  loanRepository: { listByClient: vi.fn() },
}));

import { clientRepository } from '../src/data/repositories';

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ClientDirectoryPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const CLIENTS = [
  {
    id: 'c1',
    name: 'Rosa Delgado',
    phone: '+1 809 555 0142',
    createdAt: new Date('2024-03-01'),
    portfolio: { status: 'al_dia' as const, balance: 192, principalLent: 500, installmentsPaid: 8, installmentsTotal: 12 },
  },
  {
    id: 'c2',
    name: 'Miguel Santana',
    phone: '+1 809 555 0233',
    createdAt: new Date('2024-04-01'),
    portfolio: { status: 'mora' as const, balance: 276, principalLent: 400, installmentsPaid: 3, installmentsTotal: 12, overdueDays: 3 },
  },
];

function mockListWithFilter() {
  vi.mocked(clientRepository.list).mockImplementation(async (filter) => {
    const term = filter?.search?.trim().toLowerCase();
    if (!term) return CLIENTS;
    return CLIENTS.filter((c) => c.name.toLowerCase().includes(term) || c.phone.includes(term));
  });
}

describe('ClientDirectoryPage', () => {
  it('busca clientes por nombre (spec.md, US3, escenario 1)', async () => {
    mockListWithFilter();

    renderPage();

    expect(await screen.findByText('Rosa Delgado')).toBeInTheDocument();
    expect(screen.getByText('Miguel Santana')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText(/buscar/i), 'Rosa');

    expect(screen.queryByText('Miguel Santana')).not.toBeInTheDocument();
  });

  it('muestra un estado vacío cuando la búsqueda no coincide con ningún cliente (spec.md, US3, escenario 5)', async () => {
    mockListWithFilter();

    renderPage();
    await screen.findByText('Rosa Delgado');

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText(/buscar/i), 'nadie-existe-con-este-nombre');

    expect(await screen.findByText(/sin resultados/i)).toBeInTheDocument();
  });
});
