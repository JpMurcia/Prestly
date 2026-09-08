import { formatMoney } from '@repo/core';
import { useCallback } from 'react';
import { useAppSettings } from './useAppSettings';

/**
 * Reemplaza a la antigua `lib/formatCurrency.ts` (fija en `$` estilo `en-US`, sin importar la
 * moneda real del negocio — specs/006-rebrand-currency-polish/, US1). Devuelve una función
 * `formatCurrency(amount)` ya atada a la moneda activa, así que las decenas de llamadas
 * existentes (`formatCurrency(monto)`) no cambian de forma — solo cambia cómo cada página la
 * obtiene: `const formatCurrency = useFormatCurrency();` en vez de un import estático. Delega en
 * `formatMoney` de `@repo/core`, el único punto de formato compartido con apps/mobile.
 */
export function useFormatCurrency() {
  const { currency } = useAppSettings();
  return useCallback((amount: number) => formatMoney(amount, currency), [currency]);
}
