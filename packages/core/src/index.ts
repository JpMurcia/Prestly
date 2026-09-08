export const CORE_PACKAGE_NAME = '@repo/core';

export * from './interfaces';
export { AmortizationCalculator } from './domain/AmortizationCalculator';
export { SUPPORTED_CURRENCIES, formatMoney } from './domain/currency';
export type { CurrencyCode, CurrencyMetadata } from './domain/currency';
export { FlatRateFixedInstallmentStrategy } from './strategies/FlatRateFixedInstallmentStrategy';
export { quoteLoan } from './use-cases/quoteLoan';
export { issueLoan } from './use-cases/issueLoan';
export type { IssueLoanDeps, IssueLoanInput } from './use-cases/issueLoan';
export { createStandaloneClient, DuplicatePhoneError } from './use-cases/createStandaloneClient';
export type { CreateStandaloneClientDeps } from './use-cases/createStandaloneClient';
export { registerPayment } from './use-cases/registerPayment';
export type { RegisterPaymentResult } from './use-cases/registerPayment';
export { normalizePhoneForWhatsApp } from './whatsapp/normalizePhone';
export { buildWhatsAppShareLink } from './whatsapp/buildShareLink';
export { buildLoanShareMessage, buildReceiptMessage } from './whatsapp/buildMessages';
export type { LoanShareMessageParams, ReceiptMessageParams } from './whatsapp/buildMessages';
