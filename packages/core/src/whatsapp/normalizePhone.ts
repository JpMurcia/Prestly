/**
 * Normaliza un teléfono capturado sin validación en fases anteriores (specs/001-003) a un
 * formato utilizable para WhatsApp. No corrige ni adivina un código de país — solo decide si
 * el dato existente alcanza para intentar un envío (specs/004-whatsapp-automation/,
 * data-model.md). Misma regla implementada por separado en SQL
 * (`revisar_y_enviar_notificaciones_whatsapp`, supabase/migrations/0005_whatsapp_automation.sql)
 * — no comparten código porque corren en runtimes distintos (research.md §6/§7).
 */
export function normalizePhoneForWhatsApp(rawPhone: string): string | null {
  let stripped = rawPhone.replace(/[^0-9+]/g, '');
  if (!stripped.startsWith('+')) {
    stripped = '+' + stripped.replace(/[^0-9]/g, '');
  }

  const digitCount = stripped.replace(/[^0-9]/g, '').length;
  if (digitCount < 8 || digitCount > 15) {
    return null;
  }

  return stripped;
}
