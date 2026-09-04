import { normalizePhoneForWhatsApp } from '../../src/whatsapp/normalizePhone';

describe('normalizePhoneForWhatsApp — specs/004-whatsapp-automation, data-model.md', () => {
  it('deja pasar un teléfono ya en formato internacional', () => {
    expect(normalizePhoneForWhatsApp('+1 809 555 0102')).toBe('+18095550102');
  });

  it('antepone "+" a un teléfono local con separadores', () => {
    expect(normalizePhoneForWhatsApp('809-555-0102')).toBe('+8095550102');
  });

  it('rechaza un teléfono con muy pocos dígitos (dato de prueba tipo "555-0300")', () => {
    expect(normalizePhoneForWhatsApp('555-0300')).toBeNull();
  });

  it('rechaza un valor sin dígitos utilizables', () => {
    expect(normalizePhoneForWhatsApp('n/a')).toBeNull();
  });

  it('rechaza una cadena vacía', () => {
    expect(normalizePhoneForWhatsApp('')).toBeNull();
  });

  it('rechaza un teléfono con más de 15 dígitos', () => {
    expect(normalizePhoneForWhatsApp('1234567890123456')).toBeNull();
  });
});
