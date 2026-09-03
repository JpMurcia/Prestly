import type { CollectionRouteEntry } from '@repo/core';
import { renderScreen, screen, waitFor } from '../test-utils';
import { CollectionRouteScreen } from '../src/screens/CollectionRouteScreen';
import { loanRepository } from '../src/data/repositories';

jest.mock('../src/data/repositories', () => ({
  loanRepository: { listCollectionRoute: jest.fn() },
  clientRepository: {},
}));

const mockListCollectionRoute = loanRepository.listCollectionRoute as jest.Mock;

function makeEntry(overrides: Partial<CollectionRouteEntry>): CollectionRouteEntry {
  return {
    installment: {
      id: 'installment-1',
      number: 9,
      dueDate: new Date(),
      principalPortion: 41.67,
      interestPortion: 6.25,
      totalAmount: 47.92,
      status: 'pending',
    },
    loanId: 'loan-1',
    installmentCount: 12,
    client: { id: 'client-1', name: 'Rosa Delgado', phone: '555-0001' },
    overdueDays: 0,
    ...overrides,
  };
}

/** Cubre los escenarios de aceptación 1 y 5 de US2 (spec.md): orden por prioridad con
 * resumen del día, y estado vacío cuando no quedan cobros pendientes. */
describe('CollectionRouteScreen', () => {
  afterEach(() => jest.clearAllMocks());

  it('lista los vencidos primero y muestra el resumen del día (escenario 1)', async () => {
    mockListCollectionRoute.mockResolvedValue([
      makeEntry({
        installment: { ...makeEntry({}).installment, id: 'installment-overdue' },
        client: { id: 'c1', name: 'Cliente Vencido', phone: '1' },
        overdueDays: 3,
      }),
      makeEntry({
        installment: { ...makeEntry({}).installment, id: 'installment-today' },
        client: { id: 'c2', name: 'Cliente Hoy', phone: '2' },
        overdueDays: 0,
      }),
    ]);

    await renderScreen(<CollectionRouteScreen />);

    await waitFor(() => expect(screen.getByText('Cliente Vencido')).toBeTruthy());
    expect(screen.getByText('Cliente Hoy')).toBeTruthy();
    expect(screen.getByTestId('route-summary-total')).toHaveTextContent('$95.84'); // 2 × $47.92
    expect(screen.getByTestId('route-summary-count')).toHaveTextContent('2 clientes');
  });

  it('muestra un estado vacío positivo cuando no hay cobros pendientes (escenario 5)', async () => {
    mockListCollectionRoute.mockResolvedValue([]);

    await renderScreen(<CollectionRouteScreen />);

    await waitFor(() => expect(screen.getByTestId('route-empty-state')).toBeTruthy());
  });
});
