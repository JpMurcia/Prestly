import { buildWhatsAppShareLink } from '../../src/whatsapp/buildShareLink';

describe('buildWhatsAppShareLink — specs/004-whatsapp-automation, Historia 3', () => {
  it('construye un enlace wa.me con el teléfono normalizado y el mensaje codificado', () => {
    expect(buildWhatsAppShareLink('809-555-0102', 'Hola, ¿cómo estás?')).toBe(
      'https://wa.me/8095550102?text=Hola%2C%20%C2%BFc%C3%B3mo%20est%C3%A1s%3F'
    );
  });

  it('devuelve null cuando el teléfono no normaliza, sin construir ningún enlace', () => {
    expect(buildWhatsAppShareLink('n/a', 'mensaje')).toBeNull();
  });
});
