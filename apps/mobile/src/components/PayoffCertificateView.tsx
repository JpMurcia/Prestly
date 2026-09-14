import { Alert, Linking, Modal, Pressable, Text, View } from 'react-native';
import type { PayoffCertificateData } from '@repo/core';
import { Button } from '@repo/ui/native';

export interface PayoffCertificateViewProps {
  visible: boolean;
  data: PayoffCertificateData;
  /** Ya construido por quien llama (buildWhatsAppShareLink + buildPayoffCertificateMessage),
   * `null` si el cliente no tiene un teléfono utilizable — mismo patrón que el resto de las
   * acciones de compartir de esta app (specs/004-whatsapp-automation/). */
  shareLink: string | null;
  onClose: () => void;
}

/** Certificado de Paz y Salvo (specs/008-flexible-repayment-features/, US3) — vista compartible,
 * sin persistencia (se genera bajo demanda cada vez, spec.md Assumptions). Adaptado de
 * apps/web/src/components/PayoffCertificateView.tsx — mismo dato, misma fuente. */
export function PayoffCertificateView({ visible, data, shareLink, onClose }: PayoffCertificateViewProps) {
  function openWhatsApp() {
    if (!shareLink) return;
    Linking.openURL(shareLink).catch(() => Alert.alert('No se pudo abrir WhatsApp', 'Verificá que WhatsApp esté instalado.'));
  }

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/40 p-6">
        <View className="w-full items-center gap-3 rounded-2xl bg-white p-6">
          <Text className="text-[10px] font-bold uppercase tracking-wider text-[#047857]">Certificado de Paz y Salvo</Text>
          <Text className="text-xl font-extrabold text-brand-ink">{data.clientName}</Text>
          <Text className="text-center text-sm text-neutral-500">
            Certifica que el préstamo #{data.loanId.slice(0, 8)}, por {data.principalFormatted} en {data.installmentCount}{' '}
            cuotas, quedó completamente saldado.
          </Text>
          <View className="w-full items-center rounded-lg bg-[#ECFDF5] p-4">
            <Text className="text-[10px] font-bold uppercase tracking-wider text-[#047857]">Fecha de cierre</Text>
            <Text className="text-lg font-bold text-[#065F46]">{data.closingDateFormatted}</Text>
          </View>

          <View className="mt-2 w-full gap-2">
            <Button
              testID="payoff-certificate-share"
              label="Compartir por WhatsApp"
              onPress={openWhatsApp}
              disabled={!shareLink}
            />
            <Pressable testID="payoff-certificate-close" onPress={onClose}>
              <Text className="text-center text-xs font-semibold text-neutral-400">Cerrar</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
