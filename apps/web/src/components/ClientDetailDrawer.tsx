import { Avatar, Badge, Button } from '@repo/ui/web';
import { useClientDetail } from '../hooks/useClientDetail';
import { useRegisterPayment } from '../hooks/useRegisterPayment';
import { formatCurrency } from '../lib/formatCurrency';

const SCORE_TONE = { 'A+': 'scoreAPlus', A: 'scoreA', B: 'scoreB', C: 'scoreC' } as const;

export interface ClientDetailDrawerProps {
  clientId: string;
  onClose: () => void;
}

/** Panel lateral de detalle de cliente — score, montos, mini-tabla de amortización y
 * registrar cobro (spec.md, US3, mockup 2e). */
export function ClientDetailDrawer({ clientId, onClose }: ClientDetailDrawerProps) {
  const { data, isLoading } = useClientDetail(clientId);
  const registerPayment = useRegisterPayment();

  const client = data?.client;
  const score = data?.score;
  const latestLoan = data?.loans[0];
  const nextInstallment = latestLoan?.installments.find((i) => i.status === 'pending' || i.status === 'partial');
  const nextRemainingBalance = nextInstallment ? nextInstallment.totalAmount - (nextInstallment.paidAmount ?? 0) : 0;

  return (
    <div className="fixed inset-0 z-10 flex justify-end">
      <div className="absolute inset-0 bg-brand-ink/30" onClick={onClose} />
      <div className="relative flex w-[420px] flex-col gap-5 overflow-y-auto bg-white p-6 shadow-2xl">
        <button type="button" onClick={onClose} className="self-end text-sm font-semibold text-neutral-500">
          Cerrar
        </button>

        {isLoading || !client ? (
          <p className="text-sm text-neutral-500">Cargando…</p>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <Avatar name={client.name} size={48} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-display text-[17px] font-bold tracking-tight text-brand-ink">{client.name}</span>
                  {score?.grade && <Badge label={`${score.grade}`} tone={SCORE_TONE[score.grade]} />}
                </div>
                <div className="mt-0.5 text-xs font-medium text-neutral-400">{client.phone}</div>
              </div>
            </div>

            {score && (
              <p className="text-[11.5px] font-semibold text-neutral-500">
                {score.grade
                  ? `${score.installmentsPaidOnTime} de ${score.installmentsHistorical} cuotas a tiempo`
                  : 'Sin historial todavía'}
              </p>
            )}

            <div className="flex gap-2.5">
              <MiniStat label="Prestado" value={formatCurrency(client.portfolio?.principalLent ?? 0)} />
              <MiniStat
                label="Saldo"
                value={formatCurrency(client.portfolio?.balance ?? 0)}
              />
            </div>

            {nextInstallment && (
              <Button
                label={`Registrar cobro ${formatCurrency(nextRemainingBalance)}`}
                onPress={() => registerPayment.mutate({ installmentId: nextInstallment.id, amount: nextRemainingBalance })}
                loading={registerPayment.isPending}
              />
            )}

            {latestLoan && (
              <div>
                <div className="mb-2 text-[9.5px] font-bold uppercase tracking-wider text-neutral-400">
                  Amortización · {latestLoan.id.slice(0, 8)}
                </div>
                <div className="overflow-hidden rounded-[11px] border border-neutral-200">
                  {latestLoan.installments.map((installment) => (
                    <div
                      key={installment.id}
                      className="flex items-center justify-between border-t border-neutral-100 px-3 py-2 text-[11.5px] first:border-t-0"
                    >
                      <span className="font-bold text-brand-ink">{String(installment.number).padStart(2, '0')}</span>
                      <span className="text-neutral-500">{installment.dueDate.toLocaleDateString('es-DO')}</span>
                      <span className="tabular-nums">{formatCurrency(installment.totalAmount)}</span>
                      <span className={installment.status === 'paid' ? 'text-emerald-700' : 'text-neutral-400'}>
                        {installment.status === 'paid' ? 'Pagado' : installment.status === 'partial' ? 'Parcial' : 'Pendiente'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 rounded-[10px] border border-neutral-200 bg-neutral-50 px-3 py-2.5">
      <div className="text-[10px] font-semibold text-neutral-400">{label}</div>
      <div className="font-display text-base font-extrabold tabular-nums text-brand-ink">{value}</div>
    </div>
  );
}
