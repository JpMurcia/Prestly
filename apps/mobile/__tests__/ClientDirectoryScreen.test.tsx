import type { Client } from '@repo/core';
import { fireEvent, renderScreen, screen, waitFor } from '../test-utils';
import { ClientDirectoryScreen } from '../src/screens/ClientDirectoryScreen';
import { clientRepository } from '../src/data/repositories';

jest.mock('../src/data/repositories', () => ({
  clientRepository: { list: jest.fn() },
  loanRepository: {},
}));

const mockList = clientRepository.list as jest.Mock;

function client(overrides: Partial<Client>): Client {
  return {
    id: overrides.id ?? 'c1',
    name: overrides.name ?? 'Cliente',
    phone: overrides.phone ?? '555-0000',
    createdAt: new Date(),
    portfolio: { status: 'al_dia', balance: 100, principalLent: 500, installmentsPaid: 5, installmentsTotal: 12 },
    ...overrides,
  };
}

const ALL_CLIENTS: Client[] = [
  client({ id: 'c1', name: 'Rosa Delgado', portfolio: { status: 'mora', balance: 100, principalLent: 500, installmentsPaid: 5, installmentsTotal: 12, overdueDays: 3 } }),
  client({ id: 'c2', name: 'Juan Pérez', portfolio: { status: 'al_dia', balance: 200, principalLent: 500, installmentsPaid: 6, installmentsTotal: 12 } }),
  client({ id: 'c3', name: 'Ana Torres', portfolio: { status: 'cobro_hoy', balance: 47.92, principalLent: 500, installmentsPaid: 8, installmentsTotal: 12 } }),
];

/** Cubre los escenarios de aceptación 1, 2 y 5 de US3 (spec.md): búsqueda, filtros con
 * conteo, y estado vacío sin resultados. */
describe('ClientDirectoryScreen', () => {
  afterEach(() => jest.clearAllMocks());

  it('busca por nombre y filtra por estado con conteos correctos (escenarios 1 y 2)', async () => {
    mockList.mockResolvedValue(ALL_CLIENTS);

    await renderScreen(<ClientDirectoryScreen />);

    await waitFor(() => expect(screen.getByText('Rosa Delgado')).toBeTruthy());
    expect(screen.getByText('Juan Pérez')).toBeTruthy();
    expect(screen.getByText('Ana Torres')).toBeTruthy();

    expect(screen.getByTestId('directory-filter-todos')).toHaveTextContent('Todos · 3');
    expect(screen.getByTestId('directory-filter-mora')).toHaveTextContent('Mora · 1');

    await fireEvent.press(screen.getByTestId('directory-filter-mora'));
    expect(screen.getByText('Rosa Delgado')).toBeTruthy();
    expect(screen.queryByText('Juan Pérez')).toBeNull();

    await fireEvent.press(screen.getByTestId('directory-filter-todos'));
    await fireEvent.changeText(screen.getByTestId('directory-search-input'), 'Juan');
    expect(mockList).toHaveBeenLastCalledWith({ search: 'Juan' });
  });

  it('muestra un estado vacío cuando la búsqueda no coincide con ningún cliente (escenario 5)', async () => {
    mockList.mockResolvedValue([]);

    await renderScreen(<ClientDirectoryScreen />);

    await waitFor(() => expect(screen.getByTestId('directory-empty-state')).toBeTruthy());
  });
});
