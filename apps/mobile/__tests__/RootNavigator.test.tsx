import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '../test-utils';
import { RootNavigator } from '../src/navigation/RootNavigator';
import { AuthProvider } from '../src/auth/AuthProvider';
import { authRepository } from '../src/data/repositories';

jest.mock('../src/data/repositories', () => ({
  authRepository: {
    getSession: jest.fn(),
    onSessionChange: jest.fn().mockReturnValue(() => {}),
  },
}));

async function renderRoot() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  await render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </QueryClientProvider>
  );
}

describe('RootNavigator — specs/007-admin-authentication/, US2', () => {
  afterEach(() => jest.clearAllMocks());

  it('monta LoginScreen cuando no hay sesión (FR-002)', async () => {
    (authRepository.getSession as jest.Mock).mockResolvedValue(null);

    await renderRoot();

    expect(await screen.findByTestId('login-submit')).toBeTruthy();
    expect(screen.queryByText('Directorio')).toBeNull();
  });

  it('monta el árbol de tabs cuando ya hay sesión', async () => {
    (authRepository.getSession as jest.Mock).mockResolvedValue({ userId: 'u1', email: 'admin@prestly.local' });

    await renderRoot();

    expect(await screen.findByText('Directorio')).toBeTruthy();
    expect(screen.queryByTestId('login-submit')).toBeNull();
  });
});
