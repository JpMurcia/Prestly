import { formatMoney } from '@repo/core';
import { useCallback } from 'react';
import { useAppSettings } from './useAppSettings';

/**
 * Reemplaza a `utils/money.ts` (fijo en 'en-US' sin símbolo, sin importar la moneda real del
 * negocio — specs/006-rebrand-currency-polish/, US1). Devuelve una función ya atada a la moneda
 * activa, con el símbolo incluido — a diferencia de la vieja `formatMoney`, cuyos ~30 puntos de
 * llamada anteponían un "$" literal en el JSX porque la función no lo incluía.
 */
export function useFormatCurrency() {
  const { currency } = useAppSettings();
  return useCallback((amount: number) => formatMoney(amount, currency), [currency]);
}
