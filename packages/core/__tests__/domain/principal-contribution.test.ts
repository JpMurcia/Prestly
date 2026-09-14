import { splitPaymentForInstallment } from '../../src/domain/principalContribution';

/**
 * specs/008-flexible-repayment-features, US2 — constitución principio III (Test-First): este
 * test debe existir y fallar antes de que exista splitPaymentForInstallment. Reemplaza a
 * registerPayment en el flujo de UI de "Registrar cobro" (research.md D9) — el excedente ya no
 * es "cambio a entregar", es abono a capital.
 */
describe('splitPaymentForInstallment — specs/008-flexible-repayment-features, US2', () => {
  it('sin excedente: el monto recibido es exactamente lo exigible', () => {
    expect(splitPaymentForInstallment(47.92, 47.92)).toEqual({ amountForInstallment: 47.92, principalContribution: 0 });
  });

  it('con excedente: cubre lo exigible y el resto es abono a capital (spec FR-005/FR-006)', () => {
    expect(splitPaymentForInstallment(47.92, 100)).toEqual({ amountForInstallment: 47.92, principalContribution: 52.08 });
  });

  it('monto menor a lo exigible: pago parcial válido, sin abono a capital', () => {
    expect(splitPaymentForInstallment(47.92, 20)).toEqual({ amountForInstallment: 20, principalContribution: 0 });
  });

  it('funciona igual sobre un saldo restante ya reducido por un abono parcial previo', () => {
    expect(splitPaymentForInstallment(27.92, 30)).toEqual({ amountForInstallment: 27.92, principalContribution: 2.08 });
  });

  it('un excedente exacto en centavos no arrastra error de punto flotante', () => {
    expect(splitPaymentForInstallment(43.18, 50)).toEqual({ amountForInstallment: 43.18, principalContribution: 6.82 });
  });
});
