import type { Installment, InstallmentSchedule } from '../interfaces';

export interface GracedInstallment extends Installment {
  /** Fijo desde la estructuración — true si esta cuota fue marcada "de gracia" (spec FR-001). */
  isGrace: boolean;
}

export interface GracedInstallmentSchedule {
  installments: GracedInstallment[];
  /** Idénticos a los del InstallmentSchedule de entrada — la gracia solo redistribuye CUÁNDO
   * se cobra cada monto entre cuotas, nunca CUÁNTO se cobra en total (research.md D1). */
  totalPrincipal: number;
  totalInterest: number;
  totalToPay: number;
}

/** Lanzado si se intenta marcar la última cuota del préstamo como gracia — no existiría una
 * cuota siguiente donde acumular su monto (spec FR-004, research.md D2). */
export class LastInstallmentCannotBeGraceError extends Error {
  constructor() {
    super('La última cuota de un préstamo no puede marcarse como mes de gracia.');
    this.name = 'LastInstallmentCannotBeGraceError';
  }
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Compone sobre el resultado ya calculado de `quoteLoan`/`AmortizationCalculator.calculate`
 * (nunca los modifica — OCP, constitución Principio I). Traslada el capital+interés íntegro de
 * cada cuota marcada en `graceInstallmentNumbers` hacia la cuota `numero + 1`; si hay gracias
 * consecutivas, el monto se sigue acumulando hasta la primera cuota no marcada (research.md D1).
 * Puro, sin I/O.
 */
export function applyGracePeriods(
  schedule: InstallmentSchedule,
  graceInstallmentNumbers: number[]
): GracedInstallmentSchedule {
  const graceSet = new Set(graceInstallmentNumbers);
  const lastNumber = schedule.installments.length;

  if (graceSet.has(lastNumber)) {
    throw new LastInstallmentCannotBeGraceError();
  }

  const installments: GracedInstallment[] = [];
  let carriedPrincipal = 0;
  let carriedInterest = 0;

  for (const installment of schedule.installments) {
    const effectivePrincipal = installment.principalPortion + carriedPrincipal;
    const effectiveInterest = installment.interestPortion + carriedInterest;

    if (graceSet.has(installment.number)) {
      installments.push({
        ...installment,
        principalPortion: 0,
        interestPortion: 0,
        totalAmount: 0,
        isGrace: true,
      });
      carriedPrincipal = effectivePrincipal;
      carriedInterest = effectiveInterest;
      continue;
    }

    const principalPortion = round2(effectivePrincipal);
    const interestPortion = round2(effectiveInterest);

    installments.push({
      ...installment,
      principalPortion,
      interestPortion,
      totalAmount: round2(principalPortion + interestPortion),
      isGrace: false,
    });
    carriedPrincipal = 0;
    carriedInterest = 0;
  }

  return {
    installments,
    totalPrincipal: schedule.totalPrincipal,
    totalInterest: schedule.totalInterest,
    totalToPay: schedule.totalToPay,
  };
}
