/** Formato de dinero compartido por las páginas de Admin Web — mockups usan `$` sin código
 * de moneda (spec.md raíz §9, "Supuestos": mercado único, sin multi-moneda). */
export function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
