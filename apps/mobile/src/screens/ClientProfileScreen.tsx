import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Loan, ScoreGrade } from '@repo/core';
import { Badge, Button, Card } from '@repo/ui/native';

import { useClientProfile } from '../hooks/useClientProfile';
import { useUpdateClientNotes } from '../hooks/useUpdateClientNotes';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { formatMoney } from '../utils/money';

type Props = NativeStackScreenProps<RootStackParamList, 'Perfil'>;

const GRADE_TONE: Record<ScoreGrade, 'scoreAPlus' | 'scoreA' | 'scoreB' | 'scoreC'> = {
  'A+': 'scoreAPlus',
  A: 'scoreA',
  B: 'scoreB',
  C: 'scoreC',
};

const LOAN_STATUS_LABEL: Record<Loan['status'], string> = {
  active: 'En curso',
  settled: 'Liquidado',
  cancelled: 'Cancelado',
};

/** Mockup 2c — perfil 360° del cliente: score, historial de préstamos y notas (US4). */
export function ClientProfileScreen({ route, navigation }: Props) {
  const { clientId } = route.params;
  const { data, isLoading } = useClientProfile(clientId);
  const updateNotes = useUpdateClientNotes(clientId);
  const [notesDraft, setNotesDraft] = useState('');

  useEffect(() => {
    if (data?.client.privateNotes !== undefined) setNotesDraft(data.client.privateNotes ?? '');
  }, [data?.client.privateNotes]);

  if (isLoading || !data) {
    return (
      <View className="flex-1 items-center justify-center bg-neutral-50">
        <ActivityIndicator />
      </View>
    );
  }

  const { client, score, loans } = data;

  return (
    <ScrollView className="flex-1 bg-neutral-50" contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text className="text-2xl font-extrabold text-brand-ink">{client.name}</Text>
      <Text className="text-sm text-neutral-500">{client.phone}</Text>

      <Card>
        <Text className="mb-2 text-xs font-bold uppercase text-neutral-400">Score de confianza</Text>
        {score.grade ? (
          <View className="flex-row items-center gap-2">
            <Badge testID="profile-score-grade" label={score.grade} tone={GRADE_TONE[score.grade]} />
            <Text testID="profile-score-fraction" className="text-sm text-neutral-500">
              {score.installmentsPaidOnTime} de {score.installmentsHistorical} cuotas
            </Text>
          </View>
        ) : (
          <Text testID="profile-score-grade" className="text-sm font-bold text-neutral-500">
            Sin historial
          </Text>
        )}
      </Card>

      <Card className="bg-[#FFFBEB]">
        <Text className="mb-1 text-xs font-bold uppercase text-[#B45309]">Notas privadas</Text>
        <TextInput
          testID="profile-notes-input"
          value={notesDraft}
          onChangeText={setNotesDraft}
          multiline
          placeholder="Sin notas todavía"
          className="mb-2 rounded-lg border border-[#FDE68A] bg-white p-2 text-sm text-brand-ink"
        />
        <Button
          testID="profile-notes-save"
          label={updateNotes.isPending ? 'Guardando…' : 'Guardar nota'}
          variant="secondary"
          loading={updateNotes.isPending}
          onPress={() => updateNotes.mutate(notesDraft)}
        />
      </Card>

      <Text className="text-xs font-bold uppercase text-neutral-400">Historial de préstamos</Text>
      {loans.map((loan) => {
        const paid = loan.installments.filter((i) => i.status === 'paid').length;
        return (
          <Pressable key={loan.id} onPress={() => navigation.navigate('DetallePrestamo', { loanId: loan.id })}>
            <Card testID={`profile-loan-${loan.id}`}>
              <View className="flex-row items-center justify-between">
                <Text className="font-bold text-brand-ink">${formatMoney(loan.principal)}</Text>
                <Badge label={LOAN_STATUS_LABEL[loan.status]} tone={loan.status === 'active' ? 'cobroHoy' : 'neutral'} />
              </View>
              <Text className="text-xs text-neutral-500">
                {paid} de {loan.installmentCount} cuotas
              </Text>
            </Card>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
