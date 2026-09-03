import { AmortizationCalculator } from '../src/domain/AmortizationCalculator';
import { FlatRateFixedInstallmentStrategy } from '../src/strategies/FlatRateFixedInstallmentStrategy';
import type { LoanInput } from '../src/interfaces';

/**
 * Caso de referencia de spec.md (raíz del repo) §5.1 — constitución principio III
 * (NON-NEGOTIABLE): este test debe existir y fallar antes de que exista cualquier
 * implementación de AmortizationCalculator/FlatRateFixedInstallmentStrategy.
 */
describe('AmortizationCalculator + FlatRateFixedInstallmentStrategy — caso de referencia $500/15%/12 semanas', () => {
  const input: LoanInput = {
    principal: 500,
    interestRate: 0.15,
    installmentCount: 12,
    frequency: 'weekly',
    issueDate: new Date('2026-07-01T00:00:00.000Z'),
  };

  const calculator = new AmortizationCalculator(new FlatRateFixedInstallmentStrategy());
  const schedule = calculator.calculate(input);

  it('calcula los totales exactos del caso de prueba (spec.md raíz §5.1)', () => {
    expect(schedule.totalPrincipal).toBe(500);
    expect(schedule.totalInterest).toBe(75);
    expect(schedule.totalToPay).toBe(575);
  });

  it('genera exactamente N cuotas numeradas de 1 a N', () => {
    expect(schedule.installments).toHaveLength(12);
    schedule.installments.forEach((installment, index) => {
      expect(installment.number).toBe(index + 1);
    });
  });

  it('las primeras 11 cuotas son $41.67 de capital + $6.25 de interés = $47.92', () => {
    schedule.installments.slice(0, 11).forEach((installment) => {
      expect(installment.principalPortion).toBe(41.67);
      expect(installment.interestPortion).toBe(6.25);
      expect(installment.totalAmount).toBe(47.92);
    });
  });

  it('la última cuota absorbe el residuo de redondeo (§5.3) — no rompe la reconciliación', () => {
    const last = schedule.installments[schedule.installments.length - 1]!;
    expect(last.principalPortion).toBe(41.63);
    expect(last.interestPortion).toBe(6.25);
    expect(last.totalAmount).toBe(47.88);
  });

  it('regla de conciliación (SC-002): la suma de cuotas coincide exactamente con los totales, sin excepción', () => {
    const sumPrincipal = schedule.installments.reduce((acc, i) => acc + i.principalPortion, 0);
    const sumInterest = schedule.installments.reduce((acc, i) => acc + i.interestPortion, 0);
    const sumTotal = schedule.installments.reduce((acc, i) => acc + i.totalAmount, 0);

    expect(Math.round(sumPrincipal * 100) / 100).toBe(schedule.totalPrincipal);
    expect(Math.round(sumInterest * 100) / 100).toBe(schedule.totalInterest);
    expect(Math.round(sumTotal * 100) / 100).toBe(schedule.totalToPay);
  });

  it('la frecuencia semanal separa cada vencimiento por 7 días', () => {
    const first = schedule.installments[0]!.dueDate;
    const second = schedule.installments[1]!.dueDate;
    const diffDays = (second.getTime() - first.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBe(7);
  });
});
