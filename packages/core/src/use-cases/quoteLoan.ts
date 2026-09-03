import { AmortizationCalculator } from '../domain/AmortizationCalculator';
import { FlatRateFixedInstallmentStrategy } from '../strategies/FlatRateFixedInstallmentStrategy';
import type { InstallmentSchedule, LoanInput } from '../interfaces';

/**
 * Cotizar un préstamo (US1, FR-001) — envoltorio de AmortizationCalculator con la
 * estrategia por defecto (§5.1 de spec.md raíz). Puro, sin I/O.
 */
export function quoteLoan(input: LoanInput): InstallmentSchedule {
  const calculator = new AmortizationCalculator(new FlatRateFixedInstallmentStrategy());
  return calculator.calculate(input);
}
