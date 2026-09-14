export interface PaymentSplit {
  /** Cubre lo exigible de la cuota actual — nunca más que eso (spec FR-005). */
  amountForInstallment: number;
  /** Excedente sobre lo exigible — se aplicará como abono a capital (0 si no hay excedente). */
  principalContribution: number;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Reemplaza a `registerPayment` en el flujo de UI de "Registrar cobro" (research.md D9) —
 * `registerPayment`/`RegisterPaymentResult` NO se eliminan de `@repo/core`, pero este es el
 * cálculo correcto cuando el monto recibido puede exceder lo exigible: el excedente ya no es
 * "cambio a entregar", es abono a capital. Puro, sin I/O — la persistencia real (incluido el
 * recálculo de la tabla futura) vive en `ILoanRepository.registerInstallmentPayment` →
 * `registrar_cobro` (contracts/data-contract.md).
 */
export function splitPaymentForInstallment(dueAmount: number, receivedAmount: number): PaymentSplit {
  const amountForInstallment = round2(Math.min(dueAmount, receivedAmount));
  const principalContribution = round2(Math.max(receivedAmount - dueAmount, 0));
  return { amountForInstallment, principalContribution };
}
