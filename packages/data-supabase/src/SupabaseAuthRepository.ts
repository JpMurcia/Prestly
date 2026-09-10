import { InvalidCredentialsError, type AuthSession, type IAuthRepository } from '@repo/core';
import type { SupabaseClient, User } from '@supabase/supabase-js';

function toAuthSession(user: Pick<User, 'id' | 'email'> | null | undefined): AuthSession | null {
  if (!user) return null;
  return { userId: user.id, email: user.email ?? '' };
}

/** Implementación concreta de IAuthRepository contra Supabase Auth (specs/007-admin-authentication/). */
export class SupabaseAuthRepository implements IAuthRepository {
  private readonly supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  async getSession(): Promise<AuthSession | null> {
    const { data, error } = await this.supabase.auth.getSession();
    if (error) throw error;
    return toAuthSession(data.session?.user);
  }

  onSessionChange(callback: (session: AuthSession | null) => void): () => void {
    const {
      data: { subscription },
    } = this.supabase.auth.onAuthStateChange((_event, session) => {
      callback(toAuthSession(session?.user));
    });
    return () => subscription.unsubscribe();
  }

  async signInWithPassword(email: string, password: string): Promise<AuthSession> {
    const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.code === 'invalid_credentials') throw new InvalidCredentialsError();
      throw error;
    }
    const session = toAuthSession(data.session?.user);
    if (!session) throw new InvalidCredentialsError();
    return session;
  }

  async signOut(): Promise<void> {
    const { error } = await this.supabase.auth.signOut();
    if (error) throw error;
  }
}
