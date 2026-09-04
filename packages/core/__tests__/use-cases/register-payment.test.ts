import { registerPayment } from '../../src/use-cases/registerPayment';

describe('registerPayment — specs/003-operational-management, US1', () => {
  it('aplica todo el monto recibido y no calcula cambio cuando es exacto al saldo restante', () => {
    expect(registerPayment(47.92, 47.92)).toEqual({ amountApplied: 47.92, changeDue: 0 });
  });

  it('calcula el cambio a entregar cuando el monto recibido excede el saldo restante', () => {
    expect(registerPayment(47.92, 50)).toEqual({ amountApplied: 47.92, changeDue: 2.08 });
  });

  it('un monto recibido menor al saldo restante es un pago parcial válido (ya no se rechaza, a diferencia de FR-014 de specs/001-mobile-field-app/)', () => {
    expect(registerPayment(47.92, 20)).toEqual({ amountApplied: 20, changeDue: 0 });
  });

  it('funciona igual sobre un saldo restante ya reducido por un abono parcial previo', () => {
    // Cuota de $47.92 con $20 ya abonados → saldo restante $27.92; recibir $30 aplica los
    // $27.92 que faltaban y da $2.08 de cambio.
    expect(registerPayment(27.92, 30)).toEqual({ amountApplied: 27.92, changeDue: 2.08 });
  });
});
