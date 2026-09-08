# Contract: `@repo/core` — tipos, interfaces y casos de uso nuevos

Todo en inglés (constitución, Restricciones técnicas), agregado a `packages/core/src/interfaces/index.ts` salvo donde se indique otro archivo.

## Moneda

```ts
// packages/core/src/domain/currency.ts
export type CurrencyCode = 'COP' | 'USD' | 'MXN';

export interface CurrencyMetadata {
  code: CurrencyCode;
  symbol: string;
  locale: string;
  decimals: number;
  displayName: string;
}

export const SUPPORTED_CURRENCIES: Record<CurrencyCode, CurrencyMetadata>;

/** Único punto de formato de dinero compartido por apps/web y apps/mobile (research.md §2). */
export function formatMoney(amount: number, currency: CurrencyCode): string;
```

## Configuración de la app (interfaz de repositorio)

```ts
// packages/core/src/interfaces/index.ts
export interface AppSettings {
  currency: CurrencyCode;
}

/**
 * Ajustes globales de la instalación (hoy solo moneda). Una sola interfaz de
 * lectura/escritura, no separada ISP-style — igual criterio que
 * IWhatsAppConfigRepository: un único consumidor real (la pantalla de
 * Configuración en apps/web) que siempre necesita ambas mitades juntas.
 * apps/mobile solo invoca getSettings() (research.md, Structure Decision).
 */
export interface IAppSettingsRepository {
  getSettings(): Promise<AppSettings>;
  updateCurrency(currency: CurrencyCode): Promise<AppSettings>;
}
```

## Alta de cliente sin préstamo (caso de uso puro)

```ts
// packages/core/src/use-cases/createStandaloneClient.ts
export class DuplicatePhoneError extends Error {
  constructor(phone: string);
}

export interface CreateStandaloneClientDeps {
  clientReader: Pick<IClientReader, 'findByPhone'>;
  clientWriter: Pick<IClientWriter, 'create'>;
}

/**
 * Crea un cliente sin ningún préstamo asociado (spec FR-006). A diferencia de
 * resolveClientId (interno de issueLoan.ts), que reutiliza en silencio un
 * cliente existente con el mismo teléfono, esta función RECHAZA la creación
 * lanzando DuplicatePhoneError si ya existe uno — semántica de alta explícita
 * (spec FR-007), no de "encontrar o crear" (research.md §3).
 */
export async function createStandaloneClient(
  input: NewClient,
  deps: CreateStandaloneClientDeps
): Promise<Client>;
```

## Tests requeridos (Principio III de la constitución)

- `packages/core/__tests__/domain/currency.test.ts`: `formatMoney` para las 3 monedas (decimales correctos, símbolo, separador de miles) — casos de referencia: `formatMoney(41666.67, 'COP')` → `"$41.667"` (0 decimales, redondeado), `formatMoney(47.92, 'USD')` → `"$47.92"`.
- `packages/core/__tests__/use-cases/createStandaloneClient.test.ts`: crea cuando no hay duplicado; lanza `DuplicatePhoneError` cuando `findByPhone` devuelve un cliente; nunca llama a `clientWriter.create` en el caso de duplicado (mock de guarda, no solo del resultado).
