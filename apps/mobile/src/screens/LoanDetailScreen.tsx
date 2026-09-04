import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Badge, Button, Card, ProgressBar } from '@repo/ui/native';

import { useLoan } from '../hooks/useLoan';
import { usePayoffLoan } from '../hooks/usePayoffLoan';
import { clientRepository } from '../data/repositories';
import { RegisterPaymentModal } from '../components/RegisterPaymentModal';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { formatMoney } from '../utils/money';

type Props = NativeStackScreenProps<RootStackParamList, 'DetallePrestamo'>;

/** Mockup 1b — detalle del préstamo: cliente, progreso y cronograma completo. */
export function LoanDetailScreen({ route }: Props) {
  const { loanId } = route.params;
  const { data: loan, isLoading } = useLoan(loanId);
  const { data: client } = useQuery({
    queryKey: ['loanClient', loan?.clientId],
    queryFn: () => clientRepository.findById(loan!.clientId),
    enabled: !!loan,
  });
  const [selectedInstallment, setSelectedInstallment] = useState<{ id: string; amount: number; label: string } | null>(null);
  const payoffLoan = usePayoffLoan();

  if (isLoading || !loan) {
    return (
      <View className="flex-1 items-center justify-center bg-neutral-50">
        <ActivityIndicator />
      </View>
    );
  }

  const paidCount = loan.installments.filter((i) => i.status === 'paid').length;
  // Crédito lo que sea que ya se haya cobrado, sin importar el estado (specs/003, misma
  // corrección que packages/data-supabase/src/SupabaseClientRepository.ts).
  const balance = loan.installments.reduce((acc, i) => acc + (i.totalAmount - (i.paidAmount ?? 0)), 0);
  const canPayoff = loan.status === 'active' && balance > 0;

  async function handlePayoff() {
    Alert.alert('Liquidar anticipadamente', `Se cobrará el saldo restante de $${formatMoney(balance)} y el préstamo quedará liquidado. ¿Confirmar?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar',
        onPress: async () => {
          try {
            await payoffLoan.mutateAsync(loanId);
          } catch {
            Alert.alert('No se pudo liquidar', 'Puede que ya se haya liquidado desde otro dispositivo. Cerrá y volvé a intentar.');
          }
        },
      },
    ]);
  }

  return (
    <ScrollView className="flex-1 bg-neutral-50" contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text className="text-2xl font-extrabold text-brand-ink">{client?.name ?? 'Préstamo'}</Text>

      <Card>
        <Text testID="loan-progress-label" className="mb-1 text-sm text-neutral-500">
          {paidCount} de {loan.installments.length} cuotas pagadas
        </Text>
        <ProgressBar value={loan.installments.length > 0 ? paidCount / loan.installments.length : 0} />
        <View className="mt-3 flex-row justify-between">
          <View>
            <Text className="text-lg font-bold text-brand-ink">${formatMoney(loan.principal)}</Text>
            <Text className="text-xs text-neutral-500">Prestado</Text>
          </View>
          <View>
            <Text className="text-lg font-bold text-brand-ink">${formatMoney(balance)}</Text>
            <Text className="text-xs text-neutral-500">Saldo</Text>
          </View>
        </View>
        {canPayoff && (
          <Button
            testID="loan-payoff-button"
            label={payoffLoan.isPending ? 'Liquidando…' : 'Liquidar anticipadamente'}
            onPress={handlePayoff}
            loading={payoffLoan.isPending}
          />
        )}
      </Card>

      <Text className="text-xs font-bold uppercase text-neutral-400">Cronograma</Text>
      {loan.installments.map((installment) => (
        <View
          key={installment.id}
          testID={`loan-installment-${installment.number}`}
          className="flex-row items-center justify-between rounded-lg border border-neutral-200 bg-white p-3"
        >
          <View>
            <Text className="font-bold text-brand-ink">Cuota {installment.number}</Text>
            <Text className="text-xs text-neutral-500">
              ${formatMoney(installment.totalAmount)}
              {installment.status === 'partial' && ` · faltan $${formatMoney(installment.totalAmount - (installment.paidAmount ?? 0))}`}
            </Text>
          </View>
          {installment.status === 'paid' ? (
            <Badge label="Pagado" tone="alDia" />
          ) : (
            <Pressable
              testID={`loan-installment-collect-${installment.number}`}
              onPress={() =>
                setSelectedInstallment({
                  id: installment.id,
                  amount: Math.round((installment.totalAmount - (installment.paidAmount ?? 0) + Number.EPSILON) * 100) / 100,
                  label: `Cuota ${installment.number} de ${loan.installments.length} · ${client?.name ?? ''}`,
                })
              }
            >
              <Badge label={installment.status === 'partial' ? 'Parcial' : 'Cobrar'} tone={installment.status === 'partial' ? 'neutral' : 'cobroHoy'} />
            </Pressable>
          )}
        </View>
      ))}

      {selectedInstallment && (
        <RegisterPaymentModal
          visible
          onClose={() => setSelectedInstallment(null)}
          installmentId={selectedInstallment.id}
          remainingBalance={selectedInstallment.amount}
          subtitle={selectedInstallment.label}
        />
      )}
    </ScrollView>
  );
}
