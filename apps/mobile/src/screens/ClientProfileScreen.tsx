import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Loan, ScoreGrade } from '@repo/core';
import { buildWhatsAppShareLink } from '@repo/core';
import { Badge, Button, Card } from '@repo/ui/native';

import { useClientProfile } from '../hooks/useClientProfile';
import { useFormatCurrency } from '../hooks/useFormatCurrency';
import { useUpdateClientNotes } from '../hooks/useUpdateClientNotes';
import type { RootStackParamList } from '../navigation/RootNavigator';

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
  const formatMoney = useFormatCurrency();
  const [notesDraft, setNotesDraft] = useState('');
  // Solo-lectura por defecto, con "Editar" para habilitar el campo (specs/006-rebrand-currency-polish/,
  // US4; REPORT.md hallazgo "boton"/menor de mobile-client-360-profile) — antes era siempre editable.
  const [editingNotes, setEditingNotes] = useState(false);

  useEffect(() => {
    if (data?.client.privateNotes !== undefined) setNotesDraft(data.client.privateNotes ?? '');
  }, [data?.client.privateNotes]);

  function handleSaveNotes() {
    updateNotes.mutate(notesDraft, { onSuccess: () => setEditingNotes(false) });
  }

  function handleCall() {
    if (!data) return;
    Linking.openURL(`tel:${data.client.phone}`).catch(() => undefined);
  }

  function handleWhatsApp() {
    if (!data) return;
    const link = buildWhatsAppShareLink(data.client.phone, '');
    if (!link) {
      Alert.alert('Teléfono inválido', 'No se pudo construir el enlace de WhatsApp para este cliente.');
      return;
    }
    Linking.openURL(link).catch(() => Alert.alert('No se pudo abrir WhatsApp', 'Verificá que WhatsApp esté instalado.'));
  }

  function handleNewLoan() {
    navigation.navigate('Tabs', { screen: 'Calculadora', params: { prefilledClientId: clientId } });
  }

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
        <View className="mb-1 flex-row items-center justify-between">
          <Text className="text-xs font-bold uppercase text-[#B45309]">Notas privadas</Text>
          {!editingNotes && (
            <Pressable testID="profile-notes-edit" onPress={() => setEditingNotes(true)}>
              <Text className="text-xs font-bold text-brand-navy">Editar</Text>
            </Pressable>
          )}
        </View>
        {editingNotes ? (
          <>
            <TextInput
              testID="profile-notes-input"
              value={notesDraft}
              onChangeText={setNotesDraft}
              multiline
              autoFocus
              placeholder="Sin notas todavía"
              className="mb-2 rounded-lg border border-[#FDE68A] bg-white p-2 text-sm text-brand-ink"
            />
            <Button
              testID="profile-notes-save"
              label={updateNotes.isPending ? 'Guardando…' : 'Guardar nota'}
              variant="secondary"
              loading={updateNotes.isPending}
              onPress={handleSaveNotes}
            />
          </>
        ) : (
          <Text testID="profile-notes-text" className="text-sm text-brand-ink">
            {notesDraft || 'Sin notas todavía'}
          </Text>
        )}
      </Card>

      <Text className="text-xs font-bold uppercase text-neutral-400">Historial de préstamos</Text>
      {loans.map((loan) => {
        const paid = loan.installments.filter((i) => i.status === 'paid').length;
        return (
          <Pressable key={loan.id} onPress={() => navigation.navigate('DetallePrestamo', { loanId: loan.id })}>
            <Card testID={`profile-loan-${loan.id}`}>
              <View className="flex-row items-center justify-between">
                <Text className="font-bold text-brand-ink">{formatMoney(loan.principal)}</Text>
                <Badge label={LOAN_STATUS_LABEL[loan.status]} tone={loan.status === 'active' ? 'cobroHoy' : 'neutral'} />
              </View>
              <Text className="text-xs text-neutral-500">
                {paid} de {loan.installmentCount} cuotas
              </Text>
            </Card>
          </Pressable>
        );
      })}

      {/* Barra de acciones — mockup 2c (specs/006-rebrand-currency-polish/, US4). */}
      <View className="mt-2 flex-row gap-2">
        <Button testID="profile-action-call" label="Llamar" variant="secondary" onPress={handleCall} className="flex-1" />
        <Button testID="profile-action-whatsapp" label="WhatsApp" variant="secondary" onPress={handleWhatsApp} className="flex-1" />
        <Button testID="profile-action-new-loan" label="Nuevo préstamo" onPress={handleNewLoan} className="flex-1" />
      </View>
    </ScrollView>
  );
}
