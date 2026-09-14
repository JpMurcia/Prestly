import { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { LoanInstallment } from '@repo/core';
import { buildLoanShareMessage, buildPayoffCertificate, buildPayoffCertificateMessage, buildReceiptMessage, buildWhatsAppShareLink } from '@repo/core';
import { Badge, Button, Card, ProgressBar } from '@repo/ui/native';

import { useLoan } from '../hooks/useLoan';
import { useFormatCurrency } from '../hooks/useFormatCurrency';
import { usePayoffLoan } from '../hooks/usePayoffLoan';
import { clientRepository } from '../data/repositories';
import { RegisterPaymentModal } from '../components/RegisterPaymentModal';
import { PayoffCertificateView } from '../components/PayoffCertificateView';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'DetallePrestamo'>;

/** Fecha de cierre del Certificado de Paz y Salvo — el `paidAt` más reciente entre las cuotas
 * (derivado; specs/008-flexible-repayment-features/, US3 — mismo helper que apps/web). */
function closingDate(installments: LoanInstallment[]): Date | null {
  const paidDates = installments.map((i) => i.paidAt).filter((d): d is Date => d !== undefined);
  if (paidDates.length === 0) return null;
  return new Date(Math.max(...paidDates.map((d) => d.getTime())));
}

/** Mockup 1b — detalle del préstamo: cliente, progreso y cronograma completo. */
export function LoanDetailScreen({ route }: Props) {
  const { loanId } = route.params;
  const formatMoney = useFormatCurrency();
  const { data: loan, isLoading } = useLoan(loanId);
  const { data: client } = useQuery({
    queryKey: ['loanClient', loan?.clientId],
    queryFn: () => clientRepository.findById(loan!.clientId),
    enabled: !!loan,
  });
  const [selectedInstallment, setSelectedInstallment] = useState<{ id: string; amount: number; label: string } | null>(null);
  const [showCertificate, setShowCertificate] = useState(false);
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
  const balance = Math.round((loan.installments.reduce((acc, i) => acc + (i.totalAmount - (i.paidAmount ?? 0)), 0) + Number.EPSILON) * 100) / 100;
  const canPayoff = loan.status === 'active' && balance > 0;
  // specs/008-flexible-repayment-features/, US3, FR-009 — saldo $0.00 exacto habilita el
  // certificado, sin importar cómo se llegó ahí; loan.status puede seguir 'active' si se saldó
  // por plazo normal sin liquidar_prestamo (mismo criterio que apps/web).
  const canGenerateCertificate = balance === 0;

  const payoffCertificateData =
    canGenerateCertificate && client
      ? buildPayoffCertificate({
          loan,
          client,
          principalFormatted: formatMoney(loan.principal),
          closingDateFormatted: (closingDate(loan.installments) ?? new Date()).toLocaleDateString('es'),
        })
      : null;

  const certificateShareLink =
    client && payoffCertificateData
      ? buildWhatsAppShareLink(client.phone, buildPayoffCertificateMessage(payoffCertificateData))
      : null;

  const loanShareLink =
    client && loan.installments[0]
      ? buildWhatsAppShareLink(
          client.phone,
          buildLoanShareMessage({
            clientName: client.name,
            // buildLoanShareMessage antepone su propio "$" — se lo quitamos aquí para no
            // duplicarlo, mismo patrón que apps/web (formatMoney ya incluye el símbolo).
            principalFormatted: formatMoney(loan.principal).replace('$', ''),
            installmentCount: loan.installments.length,
            firstDueDateFormatted: loan.installments[0].dueDate.toLocaleDateString('es'),
          })
        )
      : null;

  const receiptShareLink = (installment: LoanInstallment): string | null => {
    if (!client) return null;
    const paid = installment.paidAmount ?? installment.totalAmount;
    const message = buildReceiptMessage({
      clientName: client.name,
      installmentNumber: installment.number,
      installmentCount: loan.installments.length,
      amountReceivedFormatted: formatMoney(paid).replace('$', ''),
      isFullyPaid: installment.status === 'paid',
      remainingBalanceFormatted:
        installment.status === 'partial'
          ? formatMoney(installment.totalAmount - (installment.paidAmount ?? 0)).replace('$', '')
          : undefined,
    });
    return buildWhatsAppShareLink(client.phone, message);
  };

  function openWhatsApp(link: string | null) {
    if (!link) return;
    Linking.openURL(link).catch(() => Alert.alert('No se pudo abrir WhatsApp', 'Verificá que WhatsApp esté instalado.'));
  }

  async function handlePayoff() {
    Alert.alert('Liquidar anticipadamente', `Se cobrará el saldo restante de ${formatMoney(balance)} y el préstamo quedará liquidado. ¿Confirmar?`, [
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
            <Text className="text-lg font-bold text-brand-ink">{formatMoney(loan.principal)}</Text>
            <Text className="text-xs text-neutral-500">Prestado</Text>
          </View>
          <View>
            <Text className="text-lg font-bold text-brand-ink">{formatMoney(balance)}</Text>
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
        {canGenerateCertificate && (
          <Button testID="generate-payoff-certificate" label="Generar Paz y Salvo" onPress={() => setShowCertificate(true)} />
        )}
        <Pressable
          testID="whatsapp-share-loan"
          disabled={!loanShareLink}
          onPress={() => openWhatsApp(loanShareLink)}
          className="mt-2"
        >
          <Text className={loanShareLink ? 'text-center font-semibold text-brand-navy' : 'text-center text-neutral-300'}>
            Compartir tabla por WhatsApp
          </Text>
        </Pressable>
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
              {formatMoney(installment.totalAmount)}
              {installment.status === 'partial' && ` · faltan ${formatMoney(installment.totalAmount - (installment.paidAmount ?? 0))}`}
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            {!installment.isGrace && (installment.status === 'paid' || installment.status === 'partial') && (
              <Pressable
                testID={`whatsapp-receipt-${installment.number}`}
                disabled={!receiptShareLink(installment)}
                onPress={() => openWhatsApp(receiptShareLink(installment))}
              >
                <Text className={receiptShareLink(installment) ? 'text-xs font-bold text-brand-navy' : 'text-xs text-neutral-300'}>
                  WhatsApp
                </Text>
              </Pressable>
            )}
            {installment.isGrace ? (
              <Badge label="Gracia" tone="neutral" />
            ) : installment.status === 'paid' ? (
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

      {payoffCertificateData && (
        <PayoffCertificateView
          visible={showCertificate}
          data={payoffCertificateData}
          shareLink={certificateShareLink}
          onClose={() => setShowCertificate(false)}
        />
      )}
    </ScrollView>
  );
}
