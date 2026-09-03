import type { PaymentFrequency } from '@repo/core';
import { quoteLoan } from '@repo/core';
import { Button } from '@repo/ui/web';
import { useMemo, useState } from 'react';
import { useClientDirectory } from '../hooks/useClientDirectory';
import { useIssueLoan } from '../hooks/useIssueLoan';
import { formatCurrency } from '../lib/formatCurrency';

const FREQUENCY_LABEL: Record<PaymentFrequency, string> = {
  weekly: 'Semanal',
  biweekly: 'Quincenal',
  monthly: 'Mensual',
};

/** Calculadora de cotización + emisión desde escritorio — misma paridad de resultados que
 * QuoteCalculatorScreen de apps/mobile (spec.md, US4, mockup 1a/2a). */
export function QuoteCalculatorPage() {
  const [principal, setPrincipal] = useState(500);
  const [interestRatePct, setInterestRatePct] = useState(15);
  const [installmentCount, setInstallmentCount] = useState(12);
  const [frequency, setFrequency] = useState<PaymentFrequency>('weekly');

  const [clientMode, setClientMode] = useState<'nuevo' | 'existente'>('nuevo');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<{ id: string; name: string } | null>(null);
  const [issuedLoanId, setIssuedLoanId] = useState<string | null>(null);

  const issueLoan = useIssueLoan();
  const { data: existingClients } = useClientDirectory({ search: clientSearch || undefined });

  const schedule = useMemo(
    () =>
      quoteLoan({
        principal,
        interestRate: interestRatePct / 100,
        installmentCount,
        frequency,
        issueDate: new Date(),
      }),
    [principal, interestRatePct, installmentCount, frequency]
  );

  const canIssue = clientMode === 'existente' ? Boolean(selectedClient) : Boolean(clientName && clientPhone);

  function handleIssue() {
    const client =
      clientMode === 'existente' && selectedClient
        ? { existingClientId: selectedClient.id }
        : { newClient: { name: clientName, phone: clientPhone } };

    issueLoan.mutate(
      {
        schedule,
        principal,
        interestRate: interestRatePct / 100,
        installmentCount,
        frequency,
        issueDate: new Date(),
        client,
      },
      { onSuccess: (loan) => setIssuedLoanId(loan.id) }
    );
  }

  return (
    <div className="flex flex-col gap-6 p-8">
      <h1 className="font-display text-lg font-bold tracking-tight text-brand-ink">Calculadora</h1>

      <div className="grid grid-cols-2 gap-6">
        <div className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-5">
          <Field label="Monto">
            <input
              type="number"
              value={principal}
              onChange={(e) => setPrincipal(Number(e.target.value))}
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm tabular-nums"
            />
          </Field>
          <Field label="Tasa de interés (%)">
            <input
              type="number"
              value={interestRatePct}
              onChange={(e) => setInterestRatePct(Number(e.target.value))}
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm tabular-nums"
            />
          </Field>
          <Field label="Número de cuotas">
            <input
              type="number"
              value={installmentCount}
              onChange={(e) => setInstallmentCount(Number(e.target.value))}
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm tabular-nums"
            />
          </Field>
          <Field label="Frecuencia">
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as PaymentFrequency)}
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
            >
              {(Object.keys(FREQUENCY_LABEL) as PaymentFrequency[]).map((f) => (
                <option key={f} value={f}>
                  {FREQUENCY_LABEL[f]}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-5">
          <SummaryRow label="Cuota" value={formatCurrency(schedule.installments[0]?.totalAmount ?? 0)} highlight />
          <SummaryRow label="Interés total" value={formatCurrency(schedule.totalInterest)} />
          <SummaryRow label="Total a pagar" value={formatCurrency(schedule.totalToPay)} />

          {!issuedLoanId ? (
            <div className="mt-4 flex flex-col gap-3 border-t border-neutral-100 pt-4">
              <div className="flex gap-1 self-start rounded-[9px] bg-neutral-100 p-1">
                <ModeTab label="Cliente nuevo" active={clientMode === 'nuevo'} onClick={() => setClientMode('nuevo')} />
                <ModeTab
                  label="Cliente existente"
                  active={clientMode === 'existente'}
                  onClick={() => setClientMode('existente')}
                />
              </div>

              {clientMode === 'nuevo' ? (
                <>
                  <Field label="Nombre">
                    <input
                      aria-label="Nombre"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                    />
                  </Field>
                  <Field label="Teléfono">
                    <input
                      aria-label="Teléfono"
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                      className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                    />
                  </Field>
                </>
              ) : (
                <Field label="Buscar cliente">
                  <input
                    aria-label="Buscar cliente"
                    value={selectedClient?.name ?? clientSearch}
                    onChange={(e) => {
                      setSelectedClient(null);
                      setClientSearch(e.target.value);
                    }}
                    placeholder="Nombre o teléfono…"
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                  />
                  {!selectedClient && clientSearch && (
                    <div className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-neutral-200">
                      {(existingClients ?? []).map((client) => (
                        <button
                          key={client.id}
                          type="button"
                          onClick={() => setSelectedClient({ id: client.id, name: client.name })}
                          className="block w-full px-3 py-2 text-left text-sm hover:bg-neutral-50"
                        >
                          {client.name} · {client.phone}
                        </button>
                      ))}
                    </div>
                  )}
                </Field>
              )}

              <Button label="Emitir este préstamo" onPress={handleIssue} loading={issueLoan.isPending} disabled={!canIssue} />
            </div>
          ) : (
            <p className="mt-4 border-t border-neutral-100 pt-4 text-sm font-semibold text-emerald-700">
              Préstamo emitido — #{issuedLoanId.slice(0, 8)}
            </p>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <table className="w-full text-left text-[12.5px]">
          <thead>
            <tr className="h-[38px] bg-neutral-50 text-[9.5px] font-bold uppercase tracking-wider text-neutral-400">
              <th className="px-5">N°</th>
              <th className="px-5">Vencimiento</th>
              <th className="px-5 text-right">Capital</th>
              <th className="px-5 text-right">Interés</th>
              <th className="px-5 text-right">Cuota</th>
            </tr>
          </thead>
          <tbody>
            {schedule.installments.map((installment) => (
              <tr key={installment.number} className="h-[40px] border-t border-neutral-100">
                <td className="px-5 font-bold text-brand-ink">{String(installment.number).padStart(2, '0')}</td>
                <td className="px-5">{installment.dueDate.toLocaleDateString('es-DO')}</td>
                <td className="px-5 text-right tabular-nums">{formatCurrency(installment.principalPortion)}</td>
                <td className="px-5 text-right tabular-nums">{formatCurrency(installment.interestPortion)}</td>
                <td className="px-5 text-right tabular-nums font-bold text-brand-ink">
                  {formatCurrency(installment.totalAmount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ModeTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-[7px] px-3 py-1.5 text-[11px] font-bold',
        active ? 'bg-white text-brand-ink shadow-sm' : 'text-neutral-500',
      ].join(' ')}
    >
      {label}
    </button>
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

function SummaryRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-[11.5px] font-semibold text-neutral-500">{label}</span>
      <span
        className={[
          'font-display tabular-nums font-extrabold text-brand-ink',
          highlight ? 'text-2xl' : 'text-base',
        ].join(' ')}
      >
        {value}
      </span>
    </div>
  );
}
