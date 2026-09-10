import { InvalidCredentialsError } from '@repo/core';
import { SupabaseAuthRepository } from '../src/SupabaseAuthRepository';

function makeSupabase(auth: Partial<Record<string, jest.Mock>>) {
  return { auth } as never;
}

describe('SupabaseAuthRepository — specs/007-admin-authentication/', () => {
  it('getSession mapea la sesión activa a AuthSession', async () => {
    const supabase = makeSupabase({
      getSession: jest.fn().mockResolvedValue({
        data: { session: { user: { id: 'u1', email: 'admin@prestly.local' } } },
        error: null,
      }),
    });
    const repo = new SupabaseAuthRepository(supabase);

    const session = await repo.getSession();

    expect(session).toEqual({ userId: 'u1', email: 'admin@prestly.local' });
  });

  it('getSession devuelve null si no hay sesión activa', async () => {
    const supabase = makeSupabase({
      getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
    });
    const repo = new SupabaseAuthRepository(supabase);

    await expect(repo.getSession()).resolves.toBeNull();
  });

  it('signInWithPassword devuelve la sesión en credenciales correctas', async () => {
    const supabase = makeSupabase({
      signInWithPassword: jest.fn().mockResolvedValue({
        data: { session: { user: { id: 'u1', email: 'admin@prestly.local' } } },
        error: null,
      }),
    });
    const repo = new SupabaseAuthRepository(supabase);

    const session = await repo.signInWithPassword('admin@prestly.local', 'Prestly-Dev-007!');

    expect(session).toEqual({ userId: 'u1', email: 'admin@prestly.local' });
  });

  it('signInWithPassword lanza InvalidCredentialsError en credenciales incorrectas (FR-007)', async () => {
    const supabase = makeSupabase({
      signInWithPassword: jest.fn().mockResolvedValue({
        data: { session: null },
        error: { name: 'AuthApiError', code: 'invalid_credentials', status: 400, message: 'Invalid login credentials' },
      }),
    });
    const repo = new SupabaseAuthRepository(supabase);

    await expect(repo.signInWithPassword('admin@prestly.local', 'incorrecta')).rejects.toBeInstanceOf(
      InvalidCredentialsError
    );
  });

  it('signInWithPassword propaga cualquier otro error tal cual, para distinguirlo de credenciales (FR-008)', async () => {
    const networkError = { name: 'AuthRetryableFetchError', message: 'Failed to fetch' };
    const supabase = makeSupabase({
      signInWithPassword: jest.fn().mockResolvedValue({ data: { session: null }, error: networkError }),
    });
    const repo = new SupabaseAuthRepository(supabase);

    await expect(repo.signInWithPassword('admin@prestly.local', 'x')).rejects.toEqual(networkError);
  });

  it('signOut delega en supabase.auth.signOut', async () => {
    const signOutSpy = jest.fn().mockResolvedValue({ error: null });
    const supabase = makeSupabase({ signOut: signOutSpy });
    const repo = new SupabaseAuthRepository(supabase);

    await repo.signOut();

    expect(signOutSpy).toHaveBeenCalled();
  });

  it('onSessionChange se suscribe y devuelve una función para cancelar', () => {
    const unsubscribe = jest.fn();
    const onAuthStateChangeSpy = jest.fn().mockReturnValue({ data: { subscription: { unsubscribe } } });
    const supabase = makeSupabase({ onAuthStateChange: onAuthStateChangeSpy });
    const repo = new SupabaseAuthRepository(supabase);
    const callback = jest.fn();

    const unsub = repo.onSessionChange(callback);
    expect(onAuthStateChangeSpy).toHaveBeenCalled();

    const registeredHandler = onAuthStateChangeSpy.mock.calls[0][0];
    registeredHandler('SIGNED_IN', { user: { id: 'u1', email: 'admin@prestly.local' } });
    expect(callback).toHaveBeenCalledWith({ userId: 'u1', email: 'admin@prestly.local' });

    registeredHandler('SIGNED_OUT', null);
    expect(callback).toHaveBeenCalledWith(null);

    unsub();
    expect(unsubscribe).toHaveBeenCalled();
  });
});
