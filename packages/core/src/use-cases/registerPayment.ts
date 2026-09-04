export interface RegisterPaymentResult {
  /** Monto que realmente se aplica al saldo restante — el menor entre lo recibido y lo que
   * faltaba, nunca más de lo que se debe (specs/003-operational-management/, FR-004). */
  amountApplied: number;
  /** Cambio a entregar en efectivo — solo positivo cuando lo recibido excede el saldo
   * restante (mockup 1b, flujo "Efectivo"). */
  changeDue: number;
}

/**
 * Registrar el cobro de una cuota (specs/003-operational-management/, US1): calcula cuánto
 * de lo recibido se aplica al saldo restante y cuánto cambio hay que entregar si el monto
 * recibido lo excede. Un pago parcial (recibido < saldo restante) es válido — a diferencia de
 * `spec.md` raíz §1/FR-014 de `specs/001-mobile-field-app/`, esta fase ya no lo rechaza; el
 * monto que efectivamente se persiste es siempre `amountApplied`, nunca lo recibido en bruto.
 * Puro, sin I/O — la persistencia real vive en ILoanRepository.registerInstallmentPayment.
 */
export function registerPayment(remainingBalance: number, receivedAmount: number): RegisterPaymentResult {
  const amountApplied = Math.min(remainingBalance, receivedAmount);
  const changeDue = Math.round((receivedAmount - amountApplied + Number.EPSILON) * 100) / 100;
  return { amountApplied, changeDue };
}
