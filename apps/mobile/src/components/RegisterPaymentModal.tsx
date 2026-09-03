import { useState } from 'react';
import { Alert, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { PartialPaymentNotAllowedError } from '@repo/core';
import { Button, Chip } from '@repo/ui/native';

import { useRegisterPayment } from '../hooks/useRegisterPayment';
import { useNetworkStatus } from '../offline/useNetworkStatus';
import { formatMoney } from '../utils/money';

export interface RegisterPaymentModalProps {
  visible: boolean;
  onClose: () => void;
  installmentId: string;
  installmentAmount: number;
  subtitle: string;
}

type PaymentMethod = 'cash' | 'transfer';

/** Modal "Registrar cobro" (mockup 1b) — reutilizado desde la ruta de cobranza (US2) y el
 * detalle de préstamo (Polish). Cambio calculado en vivo; sin pagos parciales (FR-014). */
export function RegisterPaymentModal({ visible, onClose, installmentId, installmentAmount, subtitle }: RegisterPaymentModalProps) {
  const { isConnected } = useNetworkStatus();
  const registerPaymentMutation = useRegisterPayment();
  const [receivedText, setReceivedText] = useState(String(installmentAmount));
  const [method, setMethod] = useState<PaymentMethod>('cash');

  const receivedAmount = Number(receivedText.replace(',', '.')) || 0;
  const changeDue = Math.max(0, Math.round((receivedAmount - installmentAmount + Number.EPSILON) * 100) / 100);
  const isPartial = receivedAmount > 0 && receivedAmount < installmentAmount;

  function reset() {
    setReceivedText(String(installmentAmount));
    setMethod('cash');
  }

  async function handleConfirm() {
    if (!isConnected) {
      Alert.alert('Sin conexión', 'Necesitás conexión a internet para confirmar un cobro.');
      return;
    }
    try {
      await registerPaymentMutation.mutateAsync({ installmentId, installmentAmount, receivedAmount });
      reset();
      onClose();
    } catch (error) {
      if (error instanceof PartialPaymentNotAllowedError) {
        Alert.alert('Monto insuficiente', error.message);
        return;
      }
      Alert.alert(
        'No se pudo registrar el cobro',
        'Puede que ya se haya cobrado esta cuota desde otro dispositivo. Cerrá y volvé a intentar.'
      );
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <View className="rounded-t-2xl bg-white p-4">
          <View className="mb-1 flex-row items-center justify-between">
            <Text className="text-lg font-extrabold text-brand-ink">Registrar cobro</Text>
            <Pressable testID="payment-modal-close" onPress={onClose}>
              <Text className="text-brand-navy">Cerrar</Text>
            </Pressable>
          </View>
          <Text className="mb-4 text-sm text-neutral-500">{subtitle}</Text>

          <View className="mb-3 flex-row gap-3">
            <View className="flex-1">
              <Text className="mb-1 text-xs font-bold uppercase text-neutral-400">Monto de la cuota</Text>
              <Text testID="payment-modal-due" className="rounded-lg border border-neutral-200 px-3 py-2 text-base text-neutral-500">
                ${formatMoney(installmentAmount)}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="mb-1 text-xs font-bold uppercase text-neutral-400">Recibido</Text>
              <TextInput
                testID="payment-modal-received"
                value={receivedText}
                onChangeText={setReceivedText}
                keyboardType="numeric"
                className="rounded-lg border border-[#10B981] px-3 py-2 text-base text-brand-ink"
              />
            </View>
          </View>

          {changeDue > 0 && (
            <View testID="payment-modal-change" className="mb-3 rounded-lg bg-[#ECFDF5] p-3">
              <Text className="text-sm font-bold text-[#047857]">Cambio a entregar: ${formatMoney(changeDue)}</Text>
            </View>
          )}
          {isPartial && (
            <View testID="payment-modal-partial-warning" className="mb-3 rounded-lg bg-[#FEF2F2] p-3">
              <Text className="text-sm text-[#B91C1C]">
                El monto recibido es menor al de la cuota — no se admiten pagos parciales.
              </Text>
            </View>
          )}

          {/* El esquema de `cuotas` (spec.md raíz §4) no tiene columna para método de pago —
              se captura en la UI (mockup 1b) pero no se persiste todavía en esta fase. */}
          <Text className="mb-1 text-xs font-bold uppercase text-neutral-400">Método de pago</Text>
          <View className="mb-4 flex-row gap-2">
            <Chip testID="payment-modal-method-cash" label="Efectivo" selected={method === 'cash'} onPress={() => setMethod('cash')} />
            <Chip
              testID="payment-modal-method-transfer"
              label="Transferencia"
              selected={method === 'transfer'}
              onPress={() => setMethod('transfer')}
            />
          </View>

          <Button
            testID="payment-modal-confirm"
            label={registerPaymentMutation.isPending ? 'Confirmando…' : 'Confirmar cobro'}
            onPress={handleConfirm}
            disabled={isPartial || receivedAmount <= 0}
            loading={registerPaymentMutation.isPending}
          />
        </View>
      </View>
    </Modal>
  );
}
