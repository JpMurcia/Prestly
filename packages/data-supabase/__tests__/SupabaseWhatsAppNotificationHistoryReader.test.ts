import { SupabaseWhatsAppNotificationHistoryReader } from '../src/SupabaseWhatsAppNotificationHistoryReader';
import { fakeSupabase } from './testHelpers';

describe('SupabaseWhatsAppNotificationHistoryReader — specs/004-whatsapp-automation, Historia 1', () => {
  it('mapea las filas de notificaciones_whatsapp a WhatsAppNotification[] (camelCase, tipo/estado traducidos)', async () => {
    const rows = [
      {
        id: 'n1',
        cuota_id: 'cu1',
        cliente_id: 'cl1',
        tipo: 'recordatorio',
        estado: 'simulado',
        detalle: null,
        creado_en: '2026-09-02T09:00:00Z',
      },
      {
        id: 'n2',
        cuota_id: 'cu2',
        cliente_id: 'cl2',
        tipo: 'mora',
        estado: 'fallido',
        detalle: 'Twilio error 63007',
        creado_en: '2026-09-01T09:00:00Z',
      },
    ];
    const supabase = fakeSupabase({ data: rows, error: null });
    const reader = new SupabaseWhatsAppNotificationHistoryReader(supabase as never);

    const notifications = await reader.list();

    expect(notifications).toEqual([
      {
        id: 'n1',
        installmentId: 'cu1',
        clientId: 'cl1',
        type: 'reminder',
        result: 'simulated',
        detail: null,
        createdAt: new Date('2026-09-02T09:00:00Z'),
      },
      {
        id: 'n2',
        installmentId: 'cu2',
        clientId: 'cl2',
        type: 'overdue',
        result: 'failed',
        detail: 'Twilio error 63007',
        createdAt: new Date('2026-09-01T09:00:00Z'),
      },
    ]);
  });

  it('cartera sin notificaciones todavía devuelve un arreglo vacío, no un error', async () => {
    const supabase = fakeSupabase({ data: [], error: null });
    const reader = new SupabaseWhatsAppNotificationHistoryReader(supabase as never);

    expect(await reader.list()).toEqual([]);
  });
});
