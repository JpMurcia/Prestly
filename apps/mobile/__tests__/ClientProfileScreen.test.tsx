import type { Client, ClientScore, Loan } from '@repo/core';
import { fireEvent, renderScreen, screen, waitFor } from '../test-utils';
import { ClientProfileScreen } from '../src/screens/ClientProfileScreen';
import { appSettingsRepository, clientRepository, loanRepository } from '../src/data/repositories';

jest.mock('../src/data/repositories', () => ({
  clientRepository: { findById: jest.fn(), getScore: jest.fn(), update: jest.fn() },
  loanRepository: { listByClient: jest.fn() },
  appSettingsRepository: { getSettings: jest.fn() },
  authRepository: {
    getSession: jest.fn().mockResolvedValue({ userId: 'u1', email: 'admin@prestly.local' }),
    onSessionChange: jest.fn().mockReturnValue(() => {}),
    signOut: jest.fn().mockResolvedValue(undefined),
  },
}));

beforeEach(() => {
  (appSettingsRepository.getSettings as jest.Mock).mockResolvedValue({ currency: 'COP' });
});

const mockFindById = clientRepository.findById as jest.Mock;
const mockGetScore = clientRepository.getScore as jest.Mock;
const mockUpdate = clientRepository.update as jest.Mock;
const mockListByClient = loanRepository.listByClient as jest.Mock;

const CLIENT: Client = {
  id: 'client-1',
  name: 'Rosa Delgado',
  phone: '555-0001',
  createdAt: new Date('2024-03-01'),
};

const ACTIVE_LOAN: Loan = {
  id: 'loan-1',
  clientId: 'client-1',
  principal: 500,
  interestRate: 0.15,
  strategy: 'flatFixedInstallment',
  installmentCount: 12,
  frequency: 'weekly',
  issueDate: new Date(),
  status: 'active',
  installments: [],
  createdAt: new Date(),
};

function route(clientId = 'client-1') {
  return { params: { clientId }, key: 'Perfil-1', name: 'Perfil' as const };
}

/** Cubre los escenarios de aceptación 1, 2, 3 y 4 de US4 (spec.md): score con fracción,
 * "sin historial", historial de préstamos, y notas privadas persistidas. */
describe('ClientProfileScreen', () => {
  afterEach(() => jest.clearAllMocks());

  it('muestra el score con letra y fracción, nunca solo la letra (escenario 1)', async () => {
    mockFindById.mockResolvedValue(CLIENT);
    mockGetScore.mockResolvedValue({ grade: 'A+', installmentsPaidOnTime: 19, installmentsHistorical: 20 } satisfies ClientScore);
    mockListByClient.mockResolvedValue([ACTIVE_LOAN]);

    await renderScreen(<ClientProfileScreen route={route() as never} navigation={{} as never} />);

    await waitFor(() => expect(screen.getByTestId('profile-score-grade')).toHaveTextContent('A+'));
    expect(screen.getByTestId('profile-score-fraction')).toHaveTextContent('19 de 20 cuotas');
  });

  it('muestra "sin historial" cuando el cliente todavía no tiene cuotas vencidas (escenario 2)', async () => {
    mockFindById.mockResolvedValue(CLIENT);
    mockGetScore.mockResolvedValue({ grade: null, installmentsPaidOnTime: 0, installmentsHistorical: 0 } satisfies ClientScore);
    mockListByClient.mockResolvedValue([ACTIVE_LOAN]);

    await renderScreen(<ClientProfileScreen route={route() as never} navigation={{} as never} />);

    await waitFor(() => expect(screen.getByTestId('profile-score-grade')).toHaveTextContent('Sin historial'));
  });

  it('lista el historial de préstamos activos y liquidados (escenario 3)', async () => {
    mockFindById.mockResolvedValue(CLIENT);
    mockGetScore.mockResolvedValue({ grade: 'A', installmentsPaidOnTime: 5, installmentsHistorical: 5 } satisfies ClientScore);
    mockListByClient.mockResolvedValue([
      ACTIVE_LOAN,
      { ...ACTIVE_LOAN, id: 'loan-0', status: 'settled', issueDate: new Date('2023-01-01') },
    ]);

    await renderScreen(<ClientProfileScreen route={route() as never} navigation={{} as never} />);

    await waitFor(() => expect(screen.getByTestId('profile-loan-loan-1')).toBeTruthy());
    expect(screen.getByTestId('profile-loan-loan-0')).toBeTruthy();
  });

  it('guarda una nota privada y la persiste (escenario 4)', async () => {
    mockFindById.mockResolvedValue(CLIENT);
    mockGetScore.mockResolvedValue({ grade: null, installmentsPaidOnTime: 0, installmentsHistorical: 0 });
    mockListByClient.mockResolvedValue([]);
    mockUpdate.mockResolvedValue({ ...CLIENT, privateNotes: 'Promete pagar el viernes', notesUpdatedAt: new Date() });

    await renderScreen(<ClientProfileScreen route={route() as never} navigation={{} as never} />);
    // Solo-lectura por defecto (specs/006-rebrand-currency-polish/, US4) — hay que entrar en
    // modo edición explícitamente antes de que exista el campo de texto.
    await waitFor(() => expect(screen.getByTestId('profile-notes-edit')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('profile-notes-edit'));
    await waitFor(() => expect(screen.getByTestId('profile-notes-input')).toBeTruthy());

    await fireEvent.changeText(screen.getByTestId('profile-notes-input'), 'Promete pagar el viernes');
    await fireEvent.press(screen.getByTestId('profile-notes-save'));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith('client-1', { privateNotes: 'Promete pagar el viernes' }));
  });
});
