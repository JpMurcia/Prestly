import { InvalidCredentialsError } from '@repo/core';
import { Button, Card } from '@repo/ui/web';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authRepository } from '../data/repositories';
import { useAuth } from '../auth/useAuth';

/**
 * Login del panel (specs/007-admin-authentication/, US1). Sin flujo de registro (FR-006) — la
 * única cuenta administradora se aprovisiona fuera de esta pantalla. `InvalidCredentialsError`
 * → mensaje genérico (FR-007); cualquier otro error (red, timeout) → mensaje de conectividad
 * distinto (FR-008).
 */
export function LoginPage() {
  const { session, isLoading: isSessionLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isSessionLoading && session) navigate('/', { replace: true });
  }, [session, isSessionLoading, navigate]);

  async function submit() {
    if (isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await authRepository.signInWithPassword(email, password);
      // La sesión resultante llega por AuthProvider (onSessionChange) y dispara el efecto de arriba.
    } catch (err) {
      setError(
        err instanceof InvalidCredentialsError
          ? 'Usuario o contraseña incorrectos.'
          : 'No se pudo conectar. Revisá tu conexión a internet e intentá de nuevo.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-neutral-50 font-body">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-brand-emerald font-display text-base font-extrabold text-brand-ink">
            P
          </span>
          <span className="font-display text-lg font-extrabold tracking-tight text-brand-ink">Prestly</span>
        </div>

        <Card className="flex flex-col gap-4">
          <div>
            <h1 className="font-display text-base font-bold text-brand-ink">Iniciar sesión</h1>
            <p className="mt-0.5 text-xs font-medium text-neutral-400">Acceso exclusivo del administrador</p>
          </div>

          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Email</span>
              <input
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="rounded-lg border border-neutral-200 px-3 py-2.5 text-sm text-brand-ink outline-none focus:border-brand-emerald"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Contraseña</span>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="rounded-lg border border-neutral-200 px-3 py-2.5 text-sm text-brand-ink outline-none focus:border-brand-emerald"
              />
            </label>

            {error ? <p className="text-xs font-medium text-red-500">{error}</p> : null}

            {/* Button siempre renderiza type="button" (packages/ui/src/primitives-web/Button.tsx)
                — no dispara el submit nativo del form por sí solo, así que onPress llama a
                submit() directamente; el form.onSubmit de arriba cubre el Enter en los inputs. */}
            <Button label="Iniciar sesión" onPress={submit} loading={isSubmitting} className="mt-1 w-full" testID="login-submit" />
          </form>
        </Card>
      </div>
    </div>
  );
}
