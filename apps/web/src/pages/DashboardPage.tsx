import { Card } from '@repo/ui/web';
import { useDashboardSummary } from '../hooks/useDashboardSummary';
import { formatCurrency } from '../lib/formatCurrency';

/** Dashboard administrativo — 4 métricas de cartera (spec.md, US1, mockup 1c). */
export function DashboardPage() {
  const { data, isLoading } = useDashboardSummary();

  return (
    <div className="flex flex-col gap-5 p-8">
      <div>
        <h1 className="font-display text-lg font-bold tracking-tight text-brand-ink">Dashboard</h1>
        <p className="mt-0.5 text-xs font-medium text-neutral-400">Panorama de tu cartera</p>
      </div>

      {isLoading || !data ? (
        <p className="text-sm text-neutral-500">Cargando…</p>
      ) : (
        <div className="grid grid-cols-4 gap-5">
          <MetricCard label="Capital prestado" value={formatCurrency(data.principalLent)} tone="ink" />
          <MetricCard label="Total recuperado" value={formatCurrency(data.totalRecovered)} tone="ink" />
          <MetricCard label="Intereses ganados" value={formatCurrency(data.interestEarned)} tone="emerald" />
          <MetricCard
            label="Cartera en mora"
            value={formatCurrency(data.overdueAmount)}
            tone="danger"
            hint={
              data.overdueInstallments > 0
                ? `${data.overdueInstallments} cuotas · ${data.overdueClients} clientes`
                : undefined
            }
          />
        </div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone: 'ink' | 'emerald' | 'danger';
  hint?: string;
}) {
  const valueClass = tone === 'emerald' ? 'text-emerald-600' : tone === 'danger' ? 'text-red-500' : 'text-brand-ink';
  return (
    <Card>
      <div className="text-[9.5px] font-bold uppercase tracking-wider text-neutral-400">{label}</div>
      <div className={['mt-2 font-display text-[27px] font-extrabold tracking-tight tabular-nums', valueClass].join(' ')}>
        {value}
      </div>
      {hint && <div className="mt-1 text-[11.5px] font-semibold text-neutral-500">{hint}</div>}
    </Card>
  );
}
