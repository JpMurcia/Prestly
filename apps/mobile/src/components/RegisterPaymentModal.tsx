import { useState } from 'react';
import { Alert, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { splitPaymentForInstallment } from '@repo/core';
import { Button, Chip } from '@repo/ui/native';

import { useFormatCurrency } from '../hooks/useFormatCurrency';
import { useRegisterPayment } from '../hooks/useRegisterPayment';
import { useNetworkStatus } from '../offline/useNetworkStatus';

export interface RegisterPaymentModalProps {
  visible: boolean;
  onClose: () => void;
  installmentId: string;
  /** Saldo restante de la cuota — el monto completo si está `pending`, o lo que falte si ya
   * está `partial` (specs/003-operational-management/, US1). */
  remainingBalance: number;
  subtitle: string;
}

type PaymentMethod = 'cash' | 'transfer';

/** Modal "Registrar cobro" (mockup 1b) — reutilizado desde la ruta de cobranza (US2) y el
 * detalle de préstamo. Un monto menor al saldo restante se registra como pago parcial
 * (specs/003-operational-management/, US1 — ya no se rechaza como en FR-014 de
 * specs/001-mobile-field-app/); un monto mayor ya no rechaza ni da "cambio a entregar" — el
 * excedente se aplica como abono a capital, calculado en vivo antes de confirmar
 * (specs/008-flexible-repayment-features/, US2, research.md D9). */
export function RegisterPaymentModal({ visible, onClose, installmentId, remainingBalance, subtitle }: RegisterPaymentModalProps) {
  const { isConnected } = useNetworkStatus();
  const registerPaymentMutation = useRegisterPayment();
  const formatMoney = useFormatCurrency();
  // Redondeado defensivamente aquí también — protege contra un futuro llamador que olvide
  // redondear su propia resta en punto flotante (encontrado en verificación manual).
  const roundedRemainingBalance = Math.round((remainingBalance + Number.EPSILON) * 100) / 100;
  const [receivedText, setReceivedText] = useState(String(roundedRemainingBalance));
  const [method, setMethod] = useState<PaymentMethod>('cash');

  const receivedAmount = Number(receivedText.replace(',', '.')) || 0;
  const { amountForInstallment, principalContribution } = splitPaymentForInstallment(roundedRemainingBalance, receivedAmount);
  const isPartial = receivedAmount > 0 && receivedAmount < roundedRemainingBalance;

  function reset() {
    setReceivedText(String(roundedRemainingBalance));
    setMethod('cash');
  }

  async function handleConfirm() {
    if (!isConnected) {
      Alert.alert('Sin conexión', 'Necesitás conexión a internet para confirmar un cobro.');
      return;
    }
    try {
      // Se envía el monto completo recibido, sin capar — registrar_cobro ya sabe aplicar el
      // excedente como abono a capital (contracts/data-contract.md).
      await registerPaymentMutation.mutateAsync({ installmentId, amount: receivedAmount });
      reset();
      onClose();
    } catch {
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
              <Text className="mb-1 text-xs font-bold uppercase text-neutral-400">Saldo restante</Text>
              <Text testID="payment-modal-due" className="rounded-lg border border-neutral-200 px-3 py-2 text-base text-neutral-500">
                {formatMoney(roundedRemainingBalance)}
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

          {principalContribution > 0 && (
            <View testID="payment-modal-principal-contribution" className="mb-3 rounded-lg bg-[#ECFDF5] p-3">
              <Text className="text-sm font-bold text-[#047857]">
                Excedente de {formatMoney(principalContribution)} irá a Abono a Capital
              </Text>
            </View>
          )}
          {isPartial && (
            <View testID="payment-modal-partial-warning" className="mb-3 rounded-lg bg-[#F1F5F9] p-3">
              <Text className="text-sm text-[#475569]">
                Se registrará como pago parcial — quedarán {formatMoney(roundedRemainingBalance - amountForInstallment)} pendientes de esta cuota.
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
            disabled={receivedAmount <= 0}
            loading={registerPaymentMutation.isPending}
          />
        </View>
      </View>
    </Modal>
  );
}
