import type { AuthSession } from '@repo/core';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useEffect, useState, type ReactNode } from 'react';
import { authRepository } from '../data/repositories';

export interface AuthContextValue {
  session: AuthSession | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Sesión de Supabase Auth para toda apps/mobile (specs/007-admin-authentication/) — mismo
 * contrato que la versión web (apps/web/src/auth/AuthProvider.tsx). Resuelve la sesión existente
 * al montar y se suscribe a cambios durante toda la vida de la app; signOut también limpia la
 * caché de React Query (FR-005).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    let active = true;

    authRepository.getSession().then((initialSession) => {
      if (active) {
        setSession(initialSession);
        setIsLoading(false);
      }
    });

    const unsubscribe = authRepository.onSessionChange((nextSession) => {
      if (active) setSession(nextSession);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  async function signOut() {
    await authRepository.signOut();
    queryClient.clear();
  }

  return <AuthContext.Provider value={{ session, isLoading, signOut }}>{children}</AuthContext.Provider>;
}
