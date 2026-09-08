import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import type { Client, InstallmentSchedule, NewClient, PaymentFrequency } from '@repo/core';
import { Avatar, Button, Card } from '@repo/ui/native';

import { clientRepository } from '../data/repositories';
import { useFormatCurrency } from '../hooks/useFormatCurrency';

type ClientSelection = { existingClientId: string } | { newClient: NewClient };

export interface IssueLoanSheetProps {
  visible: boolean;
  onClose: () => void;
  schedule: InstallmentSchedule;
  principal: number;
  interestRate: number;
  installmentCount: number;
  frequency: PaymentFrequency;
  issuing: boolean;
  onConfirm: (client: ClientSelection) => Promise<void>;
  /** Cliente ya elegido de antemano (specs/006-rebrand-currency-polish/, US4: acción "Nuevo
   * préstamo" del perfil 360°) — cuando viene provisto, se salta la búsqueda/alta de cliente
   * por completo, ya que ya se sabe a quién se le está emitiendo. */
  preselectedClient?: Client;
}

/** Paso final de US1: buscar un cliente existente o capturar uno nuevo (nombre+teléfono,
 * FR-004) antes de confirmar la emisión — salvo que ya venga un `preselectedClient`. */
export function IssueLoanSheet({ visible, onClose, schedule, principal, issuing, onConfirm, preselectedClient }: IssueLoanSheetProps) {
  const formatMoney = useFormatCurrency();
  const [mode, setMode] = useState<'search' | 'new'>('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Client[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Client | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState<Client | null>(null);

  async function handleSearchChange(text: string) {
    setQuery(text);
    setSelected(null);
    if (text.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const clients = await clientRepository.list({ search: text.trim() });
      setResults(clients);
    } finally {
      setSearching(false);
    }
  }

  async function handlePhoneBlur() {
    setDuplicateWarning(null);
    if (phone.trim().length < 3) return;
    const existing = await clientRepository.findByPhone(phone.trim());
    if (existing) setDuplicateWarning(existing);
  }

  async function handleConfirm() {
    if (mode === 'search' && selected) {
      await onConfirm({ existingClientId: selected.id });
      return;
    }
    if (mode === 'new' && name.trim() && phone.trim()) {
      if (duplicateWarning) {
        await onConfirm({ existingClientId: duplicateWarning.id });
        return;
      }
      await onConfirm({ newClient: { name: name.trim(), phone: phone.trim() } });
    }
  }

  const canConfirm = Boolean(preselectedClient) ||
    (mode === 'search' && selected !== null) ||
    (mode === 'new' && name.trim() !== '' && phone.trim() !== '');

  async function handleConfirmPreselected() {
    if (!preselectedClient) return;
    await onConfirm({ existingClientId: preselectedClient.id });
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <View className="max-h-[85%] rounded-t-2xl bg-white p-4">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-lg font-extrabold text-brand-ink">Emitir préstamo</Text>
            <Pressable testID="issue-sheet-close" onPress={onClose}>
              <Text className="text-brand-navy">Cerrar</Text>
            </Pressable>
          </View>
          <Text className="mb-3 text-sm text-neutral-500">
            {formatMoney(principal)} · {installmentCountLabel(schedule)}
          </Text>

          {preselectedClient ? (
            <Card testID="issue-sheet-preselected-client" className="mb-3 flex-row items-center gap-2">
              <Avatar name={preselectedClient.name} size={28} />
              <View>
                <Text className="font-semibold text-brand-ink">{preselectedClient.name}</Text>
                <Text className="text-xs text-neutral-500">{preselectedClient.phone}</Text>
              </View>
            </Card>
          ) : (
            <View className="mb-3 flex-row gap-2">
              <Pressable testID="issue-sheet-mode-search" onPress={() => setMode('search')} className="flex-1">
                <Text className={mode === 'search' ? 'text-center font-bold text-brand-navy' : 'text-center text-neutral-400'}>
                  Cliente existente
                </Text>
              </Pressable>
              <Pressable testID="issue-sheet-mode-new" onPress={() => setMode('new')} className="flex-1">
                <Text className={mode === 'new' ? 'text-center font-bold text-brand-navy' : 'text-center text-neutral-400'}>
                  Cliente nuevo
                </Text>
              </Pressable>
            </View>
          )}

          {preselectedClient ? null : mode === 'search' ? (
            <ScrollView className="max-h-64">
              <TextInput
                testID="issue-sheet-search-input"
                value={query}
                onChangeText={handleSearchChange}
                placeholder="Buscar por nombre o teléfono"
                className="mb-2 rounded-lg border border-neutral-200 px-3 py-2"
              />
              {searching && <ActivityIndicator />}
              {results.map((client) => (
                <Pressable
                  key={client.id}
                  testID={`issue-sheet-client-${client.id}`}
                  onPress={() => setSelected(client)}
                  className={['mb-1 flex-row items-center gap-2 rounded-lg p-2', selected?.id === client.id ? 'bg-[#ECFDF5]' : ''].join(' ')}
                >
                  <Avatar name={client.name} size={28} />
                  <View>
                    <Text className="font-semibold text-brand-ink">{client.name}</Text>
                    <Text className="text-xs text-neutral-500">{client.phone}</Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <View className="gap-2">
              <TextInput
                testID="issue-sheet-name-input"
                value={name}
                onChangeText={setName}
                placeholder="Nombre completo"
                className="rounded-lg border border-neutral-200 px-3 py-2"
              />
              <TextInput
                testID="issue-sheet-phone-input"
                value={phone}
                onChangeText={setPhone}
                onBlur={handlePhoneBlur}
                placeholder="Teléfono"
                keyboardType="phone-pad"
                className="rounded-lg border border-neutral-200 px-3 py-2"
              />
              {duplicateWarning && (
                <Card className="bg-[#FFFBEB]">
                  <Text testID="issue-sheet-duplicate-warning" className="text-xs text-[#B45309]">
                    Ya existe un cliente con este teléfono ({duplicateWarning.name}) — se usará ese cliente en vez de crear uno
                    duplicado.
                  </Text>
                </Card>
              )}
            </View>
          )}

          <Button
            testID="issue-sheet-confirm"
            label={issuing ? 'Emitiendo…' : 'Confirmar emisión'}
            onPress={preselectedClient ? handleConfirmPreselected : handleConfirm}
            disabled={!canConfirm}
            loading={issuing}
            className="mt-4"
          />
        </View>
      </View>
    </Modal>
  );
}

function installmentCountLabel(schedule: InstallmentSchedule): string {
  return `${schedule.installments.length} cuotas`;
}
