import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/data/repositories', () => ({
  authRepository: {
    getSession: vi.fn(),
    onSessionChange: vi.fn().mockReturnValue(() => {}),
  },
}));

import { authRepository } from '../src/data/repositories';
import { AuthProvider } from '../src/auth/AuthProvider';
import { RequireAuth } from '../src/auth/RequireAuth';

function renderApp(initialPath: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={[initialPath]}>
          <Routes>
            <Route path="/login" element={<div>Pantalla de login</div>} />
            <Route element={<RequireAuth />}>
              <Route path="/" element={<div>Panel protegido</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

describe('RequireAuth — specs/007-admin-authentication/, US1', () => {
  it('redirige a /login cuando no hay sesión (FR-001)', async () => {
    vi.mocked(authRepository.getSession).mockResolvedValue(null);

    renderApp('/');

    expect(await screen.findByText('Pantalla de login')).toBeInTheDocument();
    expect(screen.queryByText('Panel protegido')).not.toBeInTheDocument();
  });

  it('renderiza el contenido protegido cuando ya hay sesión', async () => {
    vi.mocked(authRepository.getSession).mockResolvedValue({ userId: 'u1', email: 'admin@prestly.local' });

    renderApp('/');

    expect(await screen.findByText('Panel protegido')).toBeInTheDocument();
    expect(screen.queryByText('Pantalla de login')).not.toBeInTheDocument();
  });
});
