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
 * Sesión de Supabase Auth para todo apps/web (specs/007-admin-authentication/). Resuelve la
 * sesión existente al montar (para no parpadear a /login antes de confirmar que ya hay una) y
 * se suscribe a cambios (login/logout/refresh de token) durante toda la vida de la app.
 * signOut limpia también la caché de React Query (FR-005) — por eso vive dentro de
 * QueryClientProvider en App.tsx, no al revés.
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
