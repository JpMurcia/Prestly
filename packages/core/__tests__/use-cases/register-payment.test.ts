import { registerPayment, PartialPaymentNotAllowedError } from '../../src/use-cases/registerPayment';

describe('registerPayment — US2 (FR-008/FR-014)', () => {
  it('calcula $0 de cambio cuando el monto recibido es exactamente el de la cuota', () => {
    expect(registerPayment(47.92, 47.92)).toEqual({ changeDue: 0 });
  });

  it('calcula el cambio a entregar cuando el monto recibido es mayor al de la cuota', () => {
    expect(registerPayment(47.92, 50)).toEqual({ changeDue: 2.08 });
  });

  it('rechaza un monto recibido menor al de la cuota — sin pagos parciales (FR-014)', () => {
    expect(() => registerPayment(47.92, 40)).toThrow(PartialPaymentNotAllowedError);
  });
});
