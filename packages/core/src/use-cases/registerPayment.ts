/** Se lanza cuando el monto recibido es menor al de la cuota — FR-014, sin pagos parciales
 * en esta fase (spec.md raíz §1, "pagos parciales por cuota" fuera de alcance). */
export class PartialPaymentNotAllowedError extends Error {
  constructor(installmentAmount: number, receivedAmount: number) {
    super(
      `Monto recibido ($${receivedAmount.toFixed(2)}) es menor al de la cuota ($${installmentAmount.toFixed(2)}) — ` +
        'los pagos parciales no están soportados en esta fase (FR-014).'
    );
    this.name = 'PartialPaymentNotAllowedError';
  }
}

export interface RegisterPaymentResult {
  changeDue: number;
}

/**
 * Registrar el cobro de una cuota (US2, FR-008): calcula el cambio a entregar cuando el
 * monto recibido excede el de la cuota; rechaza montos por debajo (FR-014). Puro, sin I/O
 * — la persistencia real vive en ILoanRepository.markInstallmentPaid.
 */
export function registerPayment(installmentAmount: number, receivedAmount: number): RegisterPaymentResult {
  if (receivedAmount < installmentAmount) {
    throw new PartialPaymentNotAllowedError(installmentAmount, receivedAmount);
  }
  const changeDue = Math.round((receivedAmount - installmentAmount + Number.EPSILON) * 100) / 100;
  return { changeDue };
}
