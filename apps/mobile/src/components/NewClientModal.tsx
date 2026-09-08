import { useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import { DuplicatePhoneError } from '@repo/core';
import { Button } from '@repo/ui/native';

import { useCreateClient } from '../hooks/useCreateClient';

export interface NewClientModalProps {
  visible: boolean;
  onClose: () => void;
}

/** Alta de cliente sin préstamo (specs/006-rebrand-currency-polish/, US3) — botón "+ Nuevo"
 * del directorio (mockup 2b). Mismo par de campos (nombre/teléfono) que el modo "Cliente
 * nuevo" de IssueLoanSheet, pero sin emitir ningún préstamo. */
export function NewClientModal({ visible, onClose }: NewClientModalProps) {
  const createClient = useCreateClient();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName('');
    setPhone('');
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleConfirm() {
    setError(null);
    try {
      await createClient.mutateAsync({ name: name.trim(), phone: phone.trim() });
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof DuplicatePhoneError ? err.message : 'No se pudo crear el cliente.');
    }
  }

  const canConfirm = name.trim() !== '' && phone.trim() !== '';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View className="flex-1 justify-end bg-black/40">
        <View className="rounded-t-2xl bg-white p-4">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-lg font-extrabold text-brand-ink">Nuevo cliente</Text>
            <Pressable testID="new-client-close" onPress={handleClose}>
              <Text className="text-brand-navy">Cerrar</Text>
            </Pressable>
          </View>

          <View className="gap-2">
            <TextInput
              testID="new-client-name-input"
              value={name}
              onChangeText={setName}
              placeholder="Nombre completo"
              className="rounded-lg border border-neutral-200 px-3 py-2"
            />
            <TextInput
              testID="new-client-phone-input"
              value={phone}
              onChangeText={setPhone}
              placeholder="Teléfono"
              keyboardType="phone-pad"
              className="rounded-lg border border-neutral-200 px-3 py-2"
            />
            {error && (
              <Text testID="new-client-error" className="text-xs text-[#B91C1C]">
                {error}
              </Text>
            )}
          </View>

          <Button
            testID="new-client-confirm"
            label={createClient.isPending ? 'Guardando…' : 'Guardar cliente'}
            onPress={handleConfirm}
            disabled={!canConfirm}
            loading={createClient.isPending}
            className="mt-4"
          />
        </View>
      </View>
    </Modal>
  );
}
