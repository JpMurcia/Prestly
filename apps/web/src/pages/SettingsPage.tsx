import { SUPPORTED_CURRENCIES, type CurrencyCode, type PrincipalContributionMode } from '@repo/core';
import { Button, Card } from '@repo/ui/web';
import { useState } from 'react';
import { useAppSettings } from '../hooks/useAppSettings';
import { useClearWhatsAppCredentials, useSaveWhatsAppCredentials, useWhatsAppConfigStatus } from '../hooks/useWhatsAppConfig';
import { useWhatsAppNotifications } from '../hooks/useWhatsAppNotifications';

const NOTIFICATION_TYPE_LABEL: Record<string, string> = { reminder: 'Recordatorio', overdue: 'Mora' };
const NOTIFICATION_RESULT_LABEL: Record<string, string> = { sent: 'Enviado', simulated: 'Simulado', failed: 'Fallido' };
const NOTIFICATION_RESULT_TONE: Record<string, string> = {
  sent: 'text-emerald-600',
  simulated: 'text-neutral-500',
  failed: 'text-red-500',
};

/** Configuración global de la instalación: moneda (specs/006-rebrand-currency-polish/, US1) +
 * conexión con Twilio e historial de recordatorios/alertas (specs/004-whatsapp-automation/,
 * Historias 1 y 2) — una sola pantalla de "todo lo que configura el administrador", reemplaza
 * a la antigua WhatsAppConfigPage (que solo tenía la mitad de este contenido). */
export function SettingsPage() {
  return (
    <div className="flex flex-col gap-5 p-8">
      <div>
        <h1 className="font-display text-lg font-bold tracking-tight text-brand-ink">Configuración</h1>
        <p className="mt-0.5 text-xs font-medium text-neutral-400">Moneda, conexión con Twilio y qué se envió automáticamente</p>
      </div>

      <CurrencyPanel />
      <PrincipalContributionModePanel />
      <ConnectionPanel />
      <NotificationHistoryPanel />
    </div>
  );
}

function CurrencyPanel() {
  const { currency, isLoading, updateCurrency, isUpdating } = useAppSettings();

  return (
    <Card>
      <div className="text-[9.5px] font-bold uppercase tracking-wider text-neutral-400">Moneda</div>

      {isLoading ? (
        <p className="mt-3 text-sm text-neutral-500">Cargando…</p>
      ) : (
        <div className="mt-3 flex items-center gap-3">
          <select
            data-testid="currency-select"
            value={currency}
            disabled={isUpdating}
            onChange={(e) => updateCurrency(e.target.value as CurrencyCode)}
            className="rounded-lg border border-neutral-200 px-3 py-2 text-sm font-semibold text-brand-ink"
          >
            {Object.values(SUPPORTED_CURRENCIES).map((c) => (
              <option key={c.code} value={c.code}>
                {c.displayName} ({c.code})
              </option>
            ))}
          </select>
          {isUpdating && <span className="text-xs text-neutral-400">Guardando…</span>}
        </div>
      )}
    </Card>
  );
}

const PRINCIPAL_CONTRIBUTION_MODE_LABEL: Record<PrincipalContributionMode, string> = {
  reduce_term: 'Reducir plazo (menos cuotas restantes, mismo valor de cuota)',
  reduce_installment: 'Reducir cuota (mismo plazo, cuotas restantes más bajas)',
};

/** specs/008-flexible-repayment-features/, US2 (research.md D6) — config única de instalación,
 * mismo patrón que CurrencyPanel: apps/web es la única superficie que puede cambiarla. */
function PrincipalContributionModePanel() {
  const { principalContributionMode, isLoading, updatePrincipalContributionMode, isUpdatingPrincipalContributionMode } =
    useAppSettings();

  return (
    <Card>
      <div className="text-[9.5px] font-bold uppercase tracking-wider text-neutral-400">Modo de abono a capital</div>
      <p className="mt-1 text-xs text-neutral-500">
        Cómo se recalcula la tabla de amortización cuando un cobro excede lo exigible de la cuota.
      </p>

      {isLoading ? (
        <p className="mt-3 text-sm text-neutral-500">Cargando…</p>
      ) : (
        <div className="mt-3 flex items-center gap-3">
          <select
            data-testid="principal-contribution-mode-select"
            value={principalContributionMode}
            disabled={isUpdatingPrincipalContributionMode}
            onChange={(e) => updatePrincipalContributionMode(e.target.value as PrincipalContributionMode)}
            className="rounded-lg border border-neutral-200 px-3 py-2 text-sm font-semibold text-brand-ink"
          >
            {(Object.keys(PRINCIPAL_CONTRIBUTION_MODE_LABEL) as PrincipalContributionMode[]).map((mode) => (
              <option key={mode} value={mode}>
                {PRINCIPAL_CONTRIBUTION_MODE_LABEL[mode]}
              </option>
            ))}
          </select>
          {isUpdatingPrincipalContributionMode && <span className="text-xs text-neutral-400">Guardando…</span>}
        </div>
      )}
    </Card>
  );
}

function ConnectionPanel() {
  const { data: status, isLoading } = useWhatsAppConfigStatus();
  const saveCredentials = useSaveWhatsAppCredentials();
  const clearCredentials = useClearWhatsAppCredentials();

  const [accountSid, setAccountSid] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [fromNumber, setFromNumber] = useState('whatsapp:+14155238886');

  const canSave = Boolean(accountSid.trim() && authToken.trim() && fromNumber.trim());

  function handleSave() {
    saveCredentials.mutate(
      { accountSid, authToken, fromNumber },
      {
        onSuccess: () => {
          setAccountSid('');
          setAuthToken('');
        },
      }
    );
  }

  return (
    <Card>
      <div className="text-[9.5px] font-bold uppercase tracking-wider text-neutral-400">Conexión con Twilio</div>

      {isLoading ? (
        <p className="mt-3 text-sm text-neutral-500">Cargando…</p>
      ) : status?.connected ? (
        <div className="mt-3 flex items-center justify-between">
          <div>
            <p data-testid="whatsapp-status-connected" className="text-sm font-bold text-emerald-700">
              Conectado
            </p>
            <p className="text-xs text-neutral-500">Enviando desde {status.fromNumber}</p>
          </div>
          <Button
            testID="whatsapp-disconnect"
            label={clearCredentials.isPending ? 'Desconectando…' : 'Desconectar'}
            onPress={() => clearCredentials.mutate()}
            loading={clearCredentials.isPending}
          />
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          <p data-testid="whatsapp-status-disconnected" className="text-sm font-semibold text-neutral-500">
            No configurado — los recordatorios y alertas se registran en modo simulado hasta que conectes una cuenta.
          </p>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Account SID">
              <input
                data-testid="whatsapp-input-sid"
                value={accountSid}
                onChange={(e) => setAccountSid(e.target.value)}
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Auth Token">
              <input
                data-testid="whatsapp-input-token"
                type="password"
                value={authToken}
                onChange={(e) => setAuthToken(e.target.value)}
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Número de envío">
              <input
                data-testid="whatsapp-input-from"
                value={fromNumber}
                onChange={(e) => setFromNumber(e.target.value)}
                placeholder="whatsapp:+14155238886"
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              />
            </Field>
          </div>
          <Button
            testID="whatsapp-save"
            label={saveCredentials.isPending ? 'Guardando…' : 'Guardar conexión'}
            onPress={handleSave}
            loading={saveCredentials.isPending}
            disabled={!canSave}
          />
        </div>
      )}
    </Card>
  );
}

function NotificationHistoryPanel() {
  const { data: notifications, isLoading } = useWhatsAppNotifications();

  return (
    <Card>
      <div className="text-[9.5px] font-bold uppercase tracking-wider text-neutral-400">
        Historial de recordatorios y alertas
      </div>

      {isLoading ? (
        <p className="mt-3 text-sm text-neutral-500">Cargando…</p>
      ) : !notifications || notifications.length === 0 ? (
        <p data-testid="whatsapp-history-empty" className="mt-3 text-sm text-neutral-500">
          Todavía no se envió ni simuló ninguna notificación automática.
        </p>
      ) : (
        <table data-testid="whatsapp-history-table" className="mt-3 w-full text-left text-[12.5px]">
          <thead>
            <tr className="h-[34px] text-[9.5px] font-bold uppercase tracking-wider text-neutral-400">
              <th className="pr-4">Tipo</th>
              <th className="pr-4">Resultado</th>
              <th className="pr-4">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {notifications.map((n) => (
              <tr key={n.id} className="h-[36px] border-t border-neutral-100">
                <td className="pr-4">{NOTIFICATION_TYPE_LABEL[n.type] ?? n.type}</td>
                <td className={['pr-4 font-semibold', NOTIFICATION_RESULT_TONE[n.result] ?? ''].join(' ')}>
                  {NOTIFICATION_RESULT_LABEL[n.result] ?? n.result}
                </td>
                <td className="pr-4 text-neutral-500">{n.createdAt.toLocaleString('es-DO')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
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
