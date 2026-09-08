import { formatMoney, SUPPORTED_CURRENCIES } from '../../src/domain/currency';

// Intl usa U+00A0 (espacio de no separacion) entre el simbolo y la cifra en es-CO, no un espacio normal.
const NBSP = ' ';

describe('formatMoney', () => {
  it('formatea COP sin decimales (uso convencional en Colombia)', () => {
    expect(formatMoney(41666.67, 'COP')).toBe(`$${NBSP}41.667`);
  });

  it('formatea USD con 2 decimales', () => {
    expect(formatMoney(47.92, 'USD')).toBe('$47.92');
  });

  it('formatea MXN con 2 decimales', () => {
    expect(formatMoney(1234.5, 'MXN')).toBe('$1,234.50');
  });

  it('redondea COP al entero mas cercano en vez de truncar', () => {
    expect(formatMoney(999.5, 'COP')).toBe(`$${NBSP}1.000`);
  });
});

describe('SUPPORTED_CURRENCIES', () => {
  it('expone exactamente COP, USD y MXN con COP sin decimales', () => {
    expect(Object.keys(SUPPORTED_CURRENCIES).sort()).toEqual(['COP', 'MXN', 'USD']);
    expect(SUPPORTED_CURRENCIES.COP.decimals).toBe(0);
    expect(SUPPORTED_CURRENCIES.USD.decimals).toBe(2);
    expect(SUPPORTED_CURRENCIES.MXN.decimals).toBe(2);
  });
});
