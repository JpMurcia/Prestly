import type {
  IWhatsAppNotificationHistoryReader,
  WhatsAppNotification,
  WhatsAppNotificationResult,
  WhatsAppNotificationType,
} from '@repo/core';
import type { SupabaseClient } from '@supabase/supabase-js';

const NOTIFICATION_TYPE_FROM_DB: Record<string, WhatsAppNotificationType> = {
  recordatorio: 'reminder',
  mora: 'overdue',
};

const NOTIFICATION_RESULT_FROM_DB: Record<string, WhatsAppNotificationResult> = {
  enviado: 'sent',
  simulado: 'simulated',
  fallido: 'failed',
};

interface NotificacionWhatsAppRow {
  id: string;
  cuota_id: string;
  cliente_id: string;
  tipo: string;
  estado: string;
  detalle: string | null;
  creado_en: string;
}

function toWhatsAppNotification(row: NotificacionWhatsAppRow): WhatsAppNotification {
  return {
    id: row.id,
    installmentId: row.cuota_id,
    clientId: row.cliente_id,
    type: NOTIFICATION_TYPE_FROM_DB[row.tipo] ?? 'reminder',
    result: NOTIFICATION_RESULT_FROM_DB[row.estado] ?? 'simulated',
    detail: row.detalle,
    createdAt: new Date(row.creado_en),
  };
}

/** Implementación concreta de IWhatsAppNotificationHistoryReader — lectura directa de
 * `notificaciones_whatsapp` (specs/004-whatsapp-automation/, Historia 1, data-model.md). Solo
 * lectura: las filas las genera `revisar_y_enviar_notificaciones_whatsapp()`, nunca la app. */
export class SupabaseWhatsAppNotificationHistoryReader implements IWhatsAppNotificationHistoryReader {
  private readonly supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  async list(): Promise<WhatsAppNotification[]> {
    const { data, error } = await this.supabase
      .from('notificaciones_whatsapp')
      .select('id, cuota_id, cliente_id, tipo, estado, detalle, creado_en')
      .order('creado_en', { ascending: false })
      .returns<NotificacionWhatsAppRow[]>();

    if (error) throw error;
    return (data ?? []).map(toWhatsAppNotification);
  }
}
