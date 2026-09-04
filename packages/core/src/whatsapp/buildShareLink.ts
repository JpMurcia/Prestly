import { normalizePhoneForWhatsApp } from './normalizePhone';

/**
 * Enlace `wa.me` para las acciones manuales de compartir (specs/004-whatsapp-automation/,
 * Historia 3) — "acción, todavía no integración" (mockup, sección de supuestos). Sin backend
 * ni credenciales: abre la conversación con el mensaje ya redactado, listo para revisar y
 * enviar. `null` si el teléfono no normaliza (FR-010) — el llamador deshabilita el botón.
 */
export function buildWhatsAppShareLink(rawPhone: string, message: string): string | null {
  const normalized = normalizePhoneForWhatsApp(rawPhone);
  if (!normalized) {
    return null;
  }

  const digitsOnly = normalized.slice(1); // wa.me quiere solo dígitos, sin '+'
  return `https://wa.me/${digitsOnly}?text=${encodeURIComponent(message)}`;
}
