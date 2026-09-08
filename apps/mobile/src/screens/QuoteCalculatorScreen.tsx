import { useMemo, useState } from 'react';
import { Alert, ScrollView, Share, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useQuery } from '@tanstack/react-query';
import { quoteLoan, type PaymentFrequency } from '@repo/core';
import { Button, Card, Chip, SegmentedControl } from '@repo/ui/native';

import { clientRepository } from '../data/repositories';
import { useIssueLoan } from '../hooks/useIssueLoan';
import { useFormatCurrency } from '../hooks/useFormatCurrency';
import { useNetworkStatus } from '../offline/useNetworkStatus';
import type { RootStackParamList, TabParamList } from '../navigation/RootNavigator';
import { IssueLoanSheet } from '../components/IssueLoanSheet';

type Props = BottomTabScreenProps<TabParamList, 'Calculadora'>;

const VIEW_MODE_OPTIONS = [
  { value: 'resumen', label: 'Ver resumen' },
  { value: 'tabla', label: 'Ver tabla completa' },
];

const FREQUENCIES: { value: PaymentFrequency; label: string }[] = [
  { value: 'weekly', label: 'Semanal' },
  { value: 'biweekly', label: 'Quincenal' },
  { value: 'monthly', label: 'Mensual' },
];

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('es', { day: '2-digit', month: 'short' }).format(date);
}

/** Mockups 1a/2a — cotizar, ver tabla completa, compartir y emitir (US1). */
export function QuoteCalculatorScreen({ route }: Props) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { isConnected } = useNetworkStatus();
  const issueLoan = useIssueLoan();
  const formatMoney = useFormatCurrency();

  const prefilledClientId = route.params?.prefilledClientId;
  const { data: prefilledClient } = useQuery({
    queryKey: ['prefilledClient', prefilledClientId],
    queryFn: () => clientRepository.findById(prefilledClientId!),
    enabled: !!prefilledClientId,
  });

  const [principalText, setPrincipalText] = useState('500');
  const [ratePercentText, setRatePercentText] = useState('15');
  const [installmentsText, setInstallmentsText] = useState('12');
  const [frequency, setFrequency] = useState<PaymentFrequency>('weekly');
  const [viewMode, setViewMode] = useState<'resumen' | 'tabla'>('resumen');
  const [showIssueSheet, setShowIssueSheet] = useState(false);
  const showTable = viewMode === 'tabla';

  const principal = Number(principalText) || 0;
  const interestRate = (Number(ratePercentText) || 0) / 100;
  const installmentCount = Math.max(1, Math.trunc(Number(installmentsText) || 1));

  const schedule = useMemo(() => {
    if (principal <= 0 || installmentCount <= 0) return null;
    return quoteLoan({
      principal,
      interestRate,
      installmentCount,
      frequency,
      issueDate: new Date(),
    });
  }, [principal, interestRate, installmentCount, frequency]);

  const canIssue = schedule !== null;

  function handleShare() {
    if (!schedule) return;
    const lines = schedule.installments.map(
      (i) => `${i.number}. ${formatDate(i.dueDate)} — Cap ${formatMoney(i.principalPortion)} · Int ${formatMoney(i.interestPortion)} · Cuota ${formatMoney(i.totalAmount)}`
    );
    const message = [
      `Cotización Prestly — ${formatMoney(principal)} a ${(interestRate * 100).toFixed(0)}%, ${installmentCount} cuotas`,
      `Total a pagar: ${formatMoney(schedule.totalToPay)}`,
      '',
      ...lines,
    ].join('\n');
    // Comparte vía el selector nativo del SO, no un enlace wa.me directo: en este punto del
    // flujo todavía no hay un cliente/teléfono seleccionado (eso ocurre recién dentro de
    // IssueLoanSheet, al emitir) — a diferencia del botón de LoanDetailScreen.tsx, que sí
    // conoce al cliente. El usuario puede igual elegir WhatsApp en ese selector
    // (specs/006-rebrand-currency-polish/, REPORT.md hallazgo "boton"/menor de
    // mobile-quote-calculator: se corrige la etiqueta/intención, no el mecanismo).
    Share.share({ message }).catch(() => undefined);
  }

  function handleIssuePress() {
    if (!isConnected) {
      Alert.alert('Sin conexión', 'Necesitás conexión a internet para emitir un préstamo.');
      return;
    }
    setShowIssueSheet(true);
  }

  return (
    <ScrollView className="flex-1 bg-neutral-50" contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text className="text-2xl font-extrabold text-brand-ink">Calculadora</Text>

      <Card className="gap-3">
        <View>
          <Text className="mb-1 text-xs font-bold uppercase text-neutral-400">Monto a prestar</Text>
          <TextInput
            testID="quote-principal-input"
            value={principalText}
            onChangeText={setPrincipalText}
            keyboardType="numeric"
            className="rounded-lg border border-neutral-200 px-3 py-2 text-base text-brand-ink"
          />
        </View>
        <View>
          <Text className="mb-1 text-xs font-bold uppercase text-neutral-400">Interés (%)</Text>
          <TextInput
            testID="quote-rate-input"
            value={ratePercentText}
            onChangeText={setRatePercentText}
            keyboardType="numeric"
            className="rounded-lg border border-neutral-200 px-3 py-2 text-base text-brand-ink"
          />
        </View>
        <View>
          <Text className="mb-1 text-xs font-bold uppercase text-neutral-400">Cuotas</Text>
          <TextInput
            testID="quote-installments-input"
            value={installmentsText}
            onChangeText={setInstallmentsText}
            keyboardType="numeric"
            className="rounded-lg border border-neutral-200 px-3 py-2 text-base text-brand-ink"
          />
        </View>
        <View>
          <Text className="mb-1 text-xs font-bold uppercase text-neutral-400">Frecuencia</Text>
          <View className="flex-row gap-2">
            {FREQUENCIES.map((f) => (
              <Chip
                key={f.value}
                label={f.label}
                selected={frequency === f.value}
                onPress={() => setFrequency(f.value)}
              />
            ))}
          </View>
        </View>
      </Card>

      {schedule && (
        <Card className="gap-2 bg-[#ECFDF5]">
          <Text testID="quote-total-to-pay" className="text-3xl font-extrabold tabular-nums text-brand-ink">
            {formatMoney(schedule.totalToPay)}
          </Text>
          <Text className="text-xs font-bold uppercase text-[#047857]">Total a pagar</Text>
          <View className="flex-row justify-between pt-2">
            <View>
              <Text testID="quote-installment-amount" className="text-lg font-bold tabular-nums text-brand-ink">
                {formatMoney(schedule.installments[0]?.totalAmount ?? 0)}
              </Text>
              <Text className="text-xs text-neutral-500">Cuota</Text>
            </View>
            <View>
              <Text testID="quote-profit" className="text-lg font-bold tabular-nums text-[#047857]">
                +{formatMoney(schedule.totalInterest)}
              </Text>
              <Text className="text-xs text-neutral-500">Ganancia</Text>
            </View>
          </View>
        </Card>
      )}

      <SegmentedControl testID="quote-toggle-table" options={VIEW_MODE_OPTIONS} value={viewMode} onChange={(v) => setViewMode(v as 'resumen' | 'tabla')} />

      {showTable && schedule && (
        <Card>
          {schedule.installments.map((installment) => (
            <View
              key={installment.number}
              testID={`quote-installment-row-${installment.number}`}
              className="flex-row justify-between border-b border-neutral-100 py-2"
            >
              <Text className="w-8 text-xs text-neutral-500">{installment.number}</Text>
              <Text className="flex-1 text-xs text-neutral-500">{formatDate(installment.dueDate)}</Text>
              <Text className="w-16 text-right text-xs tabular-nums text-brand-ink">{formatMoney(installment.principalPortion)}</Text>
              <Text className="w-16 text-right text-xs tabular-nums text-brand-ink">{formatMoney(installment.interestPortion)}</Text>
              <Text className="w-16 text-right text-xs font-bold tabular-nums text-brand-ink">{formatMoney(installment.totalAmount)}</Text>
            </View>
          ))}
          <View className="flex-row justify-between pt-2">
            <Text className="flex-1 text-xs font-bold text-neutral-500">Totales</Text>
            <Text testID="quote-table-total-principal" className="w-16 text-right text-xs font-bold tabular-nums text-brand-ink">
              {formatMoney(schedule.totalPrincipal)}
            </Text>
            <Text testID="quote-table-total-interest" className="w-16 text-right text-xs font-bold tabular-nums text-brand-ink">
              {formatMoney(schedule.totalInterest)}
            </Text>
            <Text testID="quote-table-total-amount" className="w-16 text-right text-xs font-bold tabular-nums text-brand-ink">
              {formatMoney(schedule.totalToPay)}
            </Text>
          </View>
        </Card>
      )}

      <Button testID="quote-share" label="Compartir tabla por WhatsApp" variant="secondary" onPress={handleShare} disabled={!canIssue} />
      <Button testID="quote-issue" label="Emitir este préstamo" onPress={handleIssuePress} disabled={!canIssue} />

      {schedule && (
        <IssueLoanSheet
          visible={showIssueSheet}
          onClose={() => setShowIssueSheet(false)}
          schedule={schedule}
          principal={principal}
          interestRate={interestRate}
          installmentCount={installmentCount}
          frequency={frequency}
          issuing={issueLoan.isPending}
          preselectedClient={prefilledClient ?? undefined}
          onConfirm={async (client) => {
            const loan = await issueLoan.mutateAsync({
              schedule,
              principal,
              interestRate,
              installmentCount,
              frequency,
              issueDate: new Date(),
              client,
            });
            setShowIssueSheet(false);
            navigation.navigate('DetallePrestamo', { loanId: loan.id });
          }}
        />
      )}
    </ScrollView>
  );
}
