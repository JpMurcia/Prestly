import { useQuery } from '@tanstack/react-query';
import { whatsAppNotificationHistoryReader } from '../data/repositories';

/** Historial de recordatorios/alertas automáticas (specs/004-whatsapp-automation/, Historia 1). */
export function useWhatsAppNotifications() {
  return useQuery({
    queryKey: ['whatsAppNotifications'],
    queryFn: () => whatsAppNotificationHistoryReader.list(),
  });
}
