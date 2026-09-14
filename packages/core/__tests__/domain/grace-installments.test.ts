import { AmortizationCalculator } from '../../src/domain/AmortizationCalculator';
import { FlatRateFixedInstallmentStrategy } from '../../src/strategies/FlatRateFixedInstallmentStrategy';
import { applyGracePeriods, LastInstallmentCannotBeGraceError } from '../../src/domain/graceInstallments';
import type { LoanInput } from '../../src/interfaces';

/**
 * specs/008-flexible-repayment-features, US1 — constitución principio III (Test-First): este
 * test debe existir y fallar antes de que exista applyGracePeriods. Reutiliza el caso de
 * referencia $500/15%/12 semanas (research.md "Caso de prueba de referencia").
 */
describe('applyGracePeriods — specs/008-flexible-repayment-features, US1', () => {
  const input: LoanInput = {
    principal: 500,
    interestRate: 0.15,
    installmentCount: 12,
    frequency: 'weekly',
    issueDate: new Date('2026-07-01T00:00:00.000Z'),
  };

  function schedule() {
    return new AmortizationCalculator(new FlatRateFixedInstallmentStrategy()).calculate(input);
  }

  it('traslada el capital+interés íntegro de una cuota de gracia a la cuota siguiente (research.md D1)', () => {
    const result = applyGracePeriods(schedule(), [3]);
    const byNumber = (n: number) => result.installments.find((i) => i.number === n)!;

    expect(byNumber(3)).toMatchObject({ isGrace: true, principalPortion: 0, interestPortion: 0, totalAmount: 0 });
    expect(byNumber(4)).toMatchObject({ isGrace: false, principalPortion: 83.34, interestPortion: 12.5, totalAmount: 95.84 });
    // El resto del calendario no cambia.
    expect(byNumber(1)).toMatchObject({ isGrace: false, principalPortion: 41.67, interestPortion: 6.25, totalAmount: 47.92 });
    expect(byNumber(5)).toMatchObject({ isGrace: false, principalPortion: 41.67, interestPortion: 6.25, totalAmount: 47.92 });
  });

  it('dos meses de gracia no consecutivos (cuota 3 y 5) se acumulan de forma independiente', () => {
    const result = applyGracePeriods(schedule(), [3, 5]);
    const byNumber = (n: number) => result.installments.find((i) => i.number === n)!;

    expect(byNumber(3).isGrace).toBe(true);
    expect(byNumber(4)).toMatchObject({ isGrace: false, principalPortion: 83.34, interestPortion: 12.5, totalAmount: 95.84 });
    expect(byNumber(5).isGrace).toBe(true);
    expect(byNumber(6)).toMatchObject({ isGrace: false, principalPortion: 83.34, interestPortion: 12.5, totalAmount: 95.84 });
  });

  it('gracia en la cuota 1 (sin cuota previa) traslada igual a la cuota 2', () => {
    const result = applyGracePeriods(schedule(), [1]);
    const byNumber = (n: number) => result.installments.find((i) => i.number === n)!;

    expect(byNumber(1)).toMatchObject({ isGrace: true, principalPortion: 0, interestPortion: 0, totalAmount: 0 });
    expect(byNumber(2)).toMatchObject({ isGrace: false, principalPortion: 83.34, interestPortion: 12.5, totalAmount: 95.84 });
  });

  it('gracias consecutivas (3 y 4) acumulan sobre la primera cuota no marcada (5)', () => {
    const result = applyGracePeriods(schedule(), [3, 4]);
    const byNumber = (n: number) => result.installments.find((i) => i.number === n)!;

    expect(byNumber(3)).toMatchObject({ isGrace: true, totalAmount: 0 });
    expect(byNumber(4)).toMatchObject({ isGrace: true, totalAmount: 0 });
    expect(byNumber(5)).toMatchObject({ isGrace: false, principalPortion: 125.01, interestPortion: 18.75, totalAmount: 143.76 });
  });

  it('lanza LastInstallmentCannotBeGraceError al marcar la última cuota (12) como gracia', () => {
    expect(() => applyGracePeriods(schedule(), [12])).toThrow(LastInstallmentCannotBeGraceError);
  });

  it('los totales del schedule no cambian — la gracia solo redistribuye CUÁNDO se cobra, nunca CUÁNTO', () => {
    const base = schedule();
    const result = applyGracePeriods(base, [3, 5]);

    expect(result.totalPrincipal).toBe(base.totalPrincipal);
    expect(result.totalInterest).toBe(base.totalInterest);
    expect(result.totalToPay).toBe(base.totalToPay);
  });

  it('sin meses de gracia, devuelve el mismo calendario con isGrace=false en todas las cuotas', () => {
    const result = applyGracePeriods(schedule(), []);
    expect(result.installments.every((i) => i.isGrace === false)).toBe(true);
    expect(result.installments.map((i) => i.totalAmount)).toEqual(schedule().installments.map((i) => i.totalAmount));
  });
});
