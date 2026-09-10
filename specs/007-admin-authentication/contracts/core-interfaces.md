# Contract: `@repo/core` — autenticación

Todo en inglés (constitución, Restricciones técnicas), agregado a `packages/core/src/interfaces/index.ts`.

## Sesión y repositorio de autenticación

```ts
// packages/core/src/interfaces/index.ts

export interface AuthSession {
  userId: string;
  email: string;
}

/**
 * Lanzado por IAuthRepository.signInWithPassword cuando el email o la contraseña son
 * incorrectos — nunca distingue cuál de los dos, para no revelar si el usuario existe
 * (spec FR-007). Cualquier otro error (red, timeout) se deja propagar tal cual, para que la
 * UI lo distinga de este (spec FR-008). Vive en @repo/core, no junto a la implementación en
 * packages/data-supabase (a diferencia de IncompleteWhatsAppCredentialsError): la UI sí
 * necesita reconocerlo con `instanceof`, y apps/web/apps/mobile solo pueden importar
 * @repo/data-supabase desde su único data/repositories.ts (regla DIP) — mismo motivo por el
 * que DuplicatePhoneError vive en @repo/core y no junto a SupabaseClientRepository.
 */
export class InvalidCredentialsError extends Error {
  constructor();
}

/**
 * Puente hacia la sesión de Supabase Auth. Una sola interfaz de lectura/escritura, no
 * separada ISP-style — igual criterio que IAppSettingsRepository/IWhatsAppConfigRepository:
 * un único consumidor real (AuthProvider, uno por app) que siempre necesita todo el
 * contrato junto. Existe una sola cuenta (spec.md raíz §1) — ningún método acepta ni
 * expone un identificador de "otro" usuario.
 */
export interface IAuthRepository {
  /** Sesión actual, si ya se resolvió una al reabrir la app (research.md §3). `null` si no
   * hay sesión activa. */
  getSession(): Promise<AuthSession | null>;
  /** Se suscribe a cambios de sesión (login, logout, refresh de token). Devuelve una función
   * para cancelar la suscripción — se llama al desmontar AuthProvider. */
  onSessionChange(callback: (session: AuthSession | null) => void): () => void;
  /** Lanza InvalidCredentialsError si las credenciales son incorrectas. */
  signInWithPassword(email: string, password: string): Promise<AuthSession>;
  signOut(): Promise<void>;
}
```

## Tests requeridos (Principio III de la constitución)

`IAuthRepository` es un contrato puro (sin lógica propia en `@repo/core` — la implementación vive en `packages/data-supabase`, ver `contracts/data-contract.md`), así que no hay un test de `packages/core` dedicado a este archivo, mismo criterio que `ILoanRepository`/`IClientReader` (interfaces sin cuerpo no se testean; se testea quien las implementa y quien las consume).
