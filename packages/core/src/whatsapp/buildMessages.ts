/**
 * Redacción de los mensajes de las acciones manuales de compartir (specs/004-whatsapp-automation/,
 * Historia 3). Los montos/fechas llegan ya formateados por quien llama (`formatMoney` en
 * apps/mobile, `formatCurrency` en apps/web) — @repo/core no formatea moneda ni fecha, solo
 * redacta, para no introducir un tercer formateador independiente de los dos que ya existen y
 * ya son correctos.
 */

import type { PayoffCertificateData } from '../payoff/buildPayoffCertificate';

export interface LoanShareMessageParams {
  clientName: string;
  principalFormatted: string;
  installmentCount: number;
  firstDueDateFormatted: string;
}

export function buildLoanShareMessage(params: LoanShareMessageParams): string {
  return (
    `Hola ${params.clientName}, tu préstamo de $${params.principalFormatted} fue emitido en ` +
    `${params.installmentCount} cuotas. Tu primera cuota vence el ${params.firstDueDateFormatted}. ` +
    `¡Gracias por tu confianza!`
  );
}

export interface ReceiptMessageParams {
  clientName: string;
  installmentNumber: number;
  installmentCount: number;
  amountReceivedFormatted: string;
  isFullyPaid: boolean;
  /** Requerido si `isFullyPaid` es `false` (specs/004-whatsapp-automation/, contracts/core-interfaces.md). */
  remainingBalanceFormatted?: string;
}

export function buildReceiptMessage(params: ReceiptMessageParams): string {
  const base =
    `Hola ${params.clientName}, registramos tu pago de $${params.amountReceivedFormatted} ` +
    `de la cuota ${params.installmentNumber} de ${params.installmentCount}.`;

  if (params.isFullyPaid) {
    return `${base} Esa cuota quedó pagada por completo. ¡Gracias!`;
  }

  return `${base} Te quedan $${params.remainingBalanceFormatted} pendientes de esta cuota.`;
}

/**
 * Mensaje del Certificado de Paz y Salvo (specs/008-flexible-repayment-features/, US3, FR-012)
 * — reutiliza el mismo patrón de acción manual de compartir que buildLoanShareMessage/
 * buildReceiptMessage (specs/004-whatsapp-automation/, Historia 3). Toma directamente el
 * `PayoffCertificateData` ya construido por `buildPayoffCertificate`, sin volver a validar nada.
 * A diferencia de `buildLoanShareMessage`/`buildReceiptMessage` (que reciben el monto SIN el
 * símbolo de moneda y lo anteponen ellos mismos), `principalFormatted` aquí ya lo incluye — el
 * mismo valor se usa tal cual para mostrarlo en `PayoffCertificateView` (encontrado en
 * verificación manual: anteponer un "$" aquí duplicaba el símbolo, "$$ 500").
 */
export function buildPayoffCertificateMessage(data: PayoffCertificateData): string {
  return (
    `Hola ${data.clientName}, tu préstamo de ${data.principalFormatted} (${data.installmentCount} cuotas) ` +
    `quedó completamente saldado el ${data.closingDateFormatted}. ¡Gracias por tu confianza! Este mensaje es tu Paz y Salvo.`
  );
}
