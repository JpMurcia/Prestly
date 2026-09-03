import type { IInterestStrategy, InstallmentSchedule, LoanInput } from '../interfaces';

/**
 * SRP: solo calcula, nunca persiste ni renderiza (constitución principio I).
 * OCP: la fórmula concreta vive en la IInterestStrategy inyectada, no aquí.
 */
export class AmortizationCalculator {
  private readonly strategy: IInterestStrategy;

  constructor(strategy: IInterestStrategy) {
    this.strategy = strategy;
  }

  calculate(input: LoanInput): InstallmentSchedule {
    const installments = this.strategy.computeInstallments(input);

    const totalPrincipal = round2(installments.reduce((acc, i) => acc + i.principalPortion, 0));
    const totalInterest = round2(installments.reduce((acc, i) => acc + i.interestPortion, 0));
    const totalToPay = round2(installments.reduce((acc, i) => acc + i.totalAmount, 0));

    return { installments, totalPrincipal, totalInterest, totalToPay };
  }
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
