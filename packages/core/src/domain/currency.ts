/**
 * Formato de dinero compartido por apps/web y apps/mobile (specs/006-rebrand-currency-polish/,
 * research.md §2) — antes duplicado casi idéntico entre `apps/web/src/lib/formatCurrency.ts` y
 * `apps/mobile/src/utils/money.ts` (ambos forzaban 'en-US' + 2 decimales sin importar la moneda
 * real del negocio). Único punto de formato: si el criterio de decimales/símbolo cambia, cambia
 * aquí una vez.
 */
export type CurrencyCode = 'COP' | 'USD' | 'MXN';

export interface CurrencyMetadata {
  code: CurrencyCode;
  symbol: string;
  locale: string;
  /** COP se muestra sin decimales — uso convencional en Colombia, nadie maneja centavos de peso
   * en microcréditos (data-model.md). USD/MXN mantienen los 2 decimales habituales. */
  decimals: number;
  displayName: string;
}

export const SUPPORTED_CURRENCIES: Record<CurrencyCode, CurrencyMetadata> = {
  COP: { code: 'COP', symbol: '$', locale: 'es-CO', decimals: 0, displayName: 'Peso colombiano' },
  USD: { code: 'USD', symbol: '$', locale: 'en-US', decimals: 2, displayName: 'Dólar estadounidense' },
  MXN: { code: 'MXN', symbol: '$', locale: 'es-MX', decimals: 2, displayName: 'Peso mexicano' },
};

export function formatMoney(amount: number, currency: CurrencyCode): string {
  const { locale, decimals } = SUPPORTED_CURRENCIES[currency];
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}
