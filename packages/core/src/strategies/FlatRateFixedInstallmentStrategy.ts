import type { IInterestStrategy, Installment, LoanInput, PaymentFrequency } from '../interfaces';

const DAYS_PER_FREQUENCY: Record<Exclude<PaymentFrequency, 'monthly'>, number> = {
  weekly: 7,
  biweekly: 14,
};

/** Redondeo "mitad hacia arriba" a 2 decimales (spec.md raíz §5.3). */
function roundHalfUp(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function addInterval(issueDate: Date, installmentNumber: number, frequency: PaymentFrequency): Date {
  if (frequency === 'monthly') {
    const dueDate = new Date(issueDate);
    dueDate.setUTCMonth(dueDate.getUTCMonth() + installmentNumber);
    return dueDate;
  }
  const days = DAYS_PER_FREQUENCY[frequency] * installmentNumber;
  return new Date(issueDate.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * Interés simple (flat rate) con cuota fija — spec.md raíz §5.1.
 * interesTotal = capital × tasa (una sola vez, no compuesto).
 * Las primeras N-1 cuotas se redondean normalmente; la última absorbe el
 * residuo para que capital e interés sumen exactamente el total (§5.3).
 */
export class FlatRateFixedInstallmentStrategy implements IInterestStrategy {
  computeInstallments(input: LoanInput): Installment[] {
    const { principal, interestRate, installmentCount, frequency, issueDate } = input;

    const totalInterest = principal * interestRate;
    const rawPrincipalPortion = principal / installmentCount;
    const rawInterestPortion = totalInterest / installmentCount;

    const installments: Installment[] = [];
    let accumulatedPrincipal = 0;
    let accumulatedInterest = 0;

    for (let number = 1; number <= installmentCount; number += 1) {
      const isLast = number === installmentCount;

      const principalPortion = isLast
        ? roundHalfUp(principal - accumulatedPrincipal)
        : roundHalfUp(rawPrincipalPortion);
      const interestPortion = isLast
        ? roundHalfUp(totalInterest - accumulatedInterest)
        : roundHalfUp(rawInterestPortion);

      accumulatedPrincipal = roundHalfUp(accumulatedPrincipal + principalPortion);
      accumulatedInterest = roundHalfUp(accumulatedInterest + interestPortion);

      installments.push({
        number,
        dueDate: addInterval(issueDate, number, frequency),
        principalPortion,
        interestPortion,
        totalAmount: roundHalfUp(principalPortion + interestPortion),
      });
    }

    return installments;
  }
}
