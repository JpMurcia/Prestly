import { DuplicatePhoneError } from '@repo/core';
import { Button } from '@repo/ui/web';
import { useState } from 'react';
import { useCreateClient } from '../hooks/useCreateClient';

export interface NewClientModalProps {
  onClose: () => void;
}

/** Alta de cliente sin préstamo (specs/006-rebrand-currency-polish/, US3) — botón "Nuevo
 * cliente" del directorio de clientes (mockup 2e). */
export function NewClientModal({ onClose }: NewClientModalProps) {
  const createClient = useCreateClient();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState<string | null>(null);

  const canConfirm = name.trim() !== '' && phone.trim() !== '';

  async function handleConfirm() {
    setError(null);
    try {
      await createClient.mutateAsync({ name: name.trim(), phone: phone.trim(), address: address.trim() || undefined });
      onClose();
    } catch (err) {
      setError(err instanceof DuplicatePhoneError ? err.message : 'No se pudo crear el cliente.');
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40">
      <div className="w-[380px] rounded-xl bg-white p-5">
        <h2 className="font-display text-base font-bold text-brand-ink">Nuevo cliente</h2>
        <div className="mt-3 flex flex-col gap-3">
          <Field label="Nombre">
            <input
              data-testid="new-client-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Teléfono">
            <input
              data-testid="new-client-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Dirección (opcional)">
            <input
              data-testid="new-client-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
            />
          </Field>
          {error && (
            <p data-testid="new-client-error" className="text-xs font-semibold text-red-600">
              {error}
            </p>
          )}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button testID="new-client-cancel" label="Cancelar" variant="secondary" onPress={onClose} />
          <Button
            testID="new-client-confirm"
            label={createClient.isPending ? 'Guardando…' : 'Guardar cliente'}
            onPress={handleConfirm}
            loading={createClient.isPending}
            disabled={!canConfirm}
          />
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-[11.5px] font-semibold text-neutral-500">
      {label}
      {children}
    </label>
  );
}
