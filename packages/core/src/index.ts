export const CORE_PACKAGE_NAME = '@repo/core';

export * from './interfaces';
export { AmortizationCalculator } from './domain/AmortizationCalculator';
export { FlatRateFixedInstallmentStrategy } from './strategies/FlatRateFixedInstallmentStrategy';
export { quoteLoan } from './use-cases/quoteLoan';
export { issueLoan } from './use-cases/issueLoan';
export type { IssueLoanDeps, IssueLoanInput } from './use-cases/issueLoan';
export { registerPayment, PartialPaymentNotAllowedError } from './use-cases/registerPayment';
export type { RegisterPaymentResult } from './use-cases/registerPayment';
