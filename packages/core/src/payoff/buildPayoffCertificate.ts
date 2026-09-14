import type { Client, Loan } from '../interfaces';

export interface PayoffCertificateData {
  clientName: string;
  loanId: string;
  /** Ya formateado por quien llama — mismo criterio que buildLoanShareMessage/buildReceiptMessage
   * (@repo/core no formatea moneda ni fecha, spec.md raíz, whatsapp/buildMessages.ts). */
  principalFormatted: string;
  installmentCount: number;
  closingDateFormatted: string;
}

/** Lanzado si se solicita el certificado con saldo distinto de $0.00 (spec FR-009, Edge Cases). */
export class LoanNotFullySettledError extends Error {
  constructor() {
    super('El préstamo todavía tiene saldo pendiente — no se puede generar el Paz y Salvo.');
    this.name = 'LoanNotFullySettledError';
  }
}

export interface BuildPayoffCertificateParams {
  loan: Loan;
  client: Pick<Client, 'name'>;
  /** Formateados por quien llama, mismo criterio que arriba. */
  principalFormatted: string;
  closingDateFormatted: string;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function remainingBalance(loan: Loan): number {
  return round2(loan.installments.reduce((acc, i) => acc + (i.totalAmount - (i.paidAmount ?? 0)), 0));
}

/**
 * Construye los datos del certificado — no persiste nada (spec.md Assumptions: se genera bajo
 * demanda). Valida que el saldo restante del préstamo (derivado de `loan.installments`, mismo
 * cálculo que `remainingBalance` ya usado en LoanAmortizationPage) sea exactamente $0.00 antes de
 * construir el documento. La fecha de cierre NO se deriva aquí — llega ya resuelta y formateada
 * por quien llama (contracts/core-interfaces.md §3).
 *
 * @throws LoanNotFullySettledError si el saldo restante no es exactamente 0.
 */
export function buildPayoffCertificate(params: BuildPayoffCertificateParams): PayoffCertificateData {
  const { loan, client, principalFormatted, closingDateFormatted } = params;

  if (remainingBalance(loan) !== 0) {
    throw new LoanNotFullySettledError();
  }

  return {
    clientName: client.name,
    loanId: loan.id,
    principalFormatted,
    installmentCount: loan.installments.length,
    closingDateFormatted,
  };
}
