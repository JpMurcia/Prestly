import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './useAuth';

/**
 * Guarda de acceso única para todo el panel (specs/007-admin-authentication/, FR-001) — envuelve
 * `element: <AppShell />` en router.tsx en vez de proteger cada página por separado (research.md
 * §8): un solo punto de verdad, no se puede rodear navegando directo a una ruta interna.
 */
export function RequireAuth() {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-50 text-sm font-medium text-neutral-400">
        Cargando…
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;

  return <Outlet />;
}
