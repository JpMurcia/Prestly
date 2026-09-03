import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Badge, Card, ProgressBar } from '@repo/ui/native';

import { useLoan } from '../hooks/useLoan';
import { clientRepository } from '../data/repositories';
import { RegisterPaymentModal } from '../components/RegisterPaymentModal';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { formatMoney } from '../utils/money';

type Props = NativeStackScreenProps<RootStackParamList, 'DetallePrestamo'>;

/** Mockup 1b — detalle del préstamo: cliente, progreso y cronograma completo (Polish). */
export function LoanDetailScreen({ route }: Props) {
  const { loanId } = route.params;
  const { data: loan, isLoading } = useLoan(loanId);
  const { data: client } = useQuery({
    queryKey: ['loanClient', loan?.clientId],
    queryFn: () => clientRepository.findById(loan!.clientId),
    enabled: !!loan,
  });
  const [selectedInstallment, setSelectedInstallment] = useState<{ id: string; amount: number; label: string } | null>(null);

  if (isLoading || !loan) {
    return (
      <View className="flex-1 items-center justify-center bg-neutral-50">
        <ActivityIndicator />
      </View>
    );
  }

  const paidCount = loan.installments.filter((i) => i.status === 'paid').length;
  const balance = loan.installments.reduce((acc, i) => acc + (i.status === 'paid' ? 0 : i.totalAmount), 0);

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
            <Text className="text-xs text-neutral-500">${formatMoney(installment.totalAmount)}</Text>
          </View>
          {installment.status === 'paid' ? (
            <Badge label="Pagado" tone="alDia" />
          ) : (
            <Pressable
              testID={`loan-installment-collect-${installment.number}`}
              onPress={() =>
                setSelectedInstallment({
                  id: installment.id,
                  amount: installment.totalAmount,
                  label: `Cuota ${installment.number} de ${loan.installments.length} · ${client?.name ?? ''}`,
                })
              }
            >
              <Badge label="Cobrar" tone="cobroHoy" />
            </Pressable>
          )}
        </View>
      ))}

      {selectedInstallment && (
        <RegisterPaymentModal
          visible
          onClose={() => setSelectedInstallment(null)}
          installmentId={selectedInstallment.id}
          installmentAmount={selectedInstallment.amount}
          subtitle={selectedInstallment.label}
        />
      )}
    </ScrollView>
  );
}
