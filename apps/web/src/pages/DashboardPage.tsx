import { Card } from '@repo/ui/web';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useDashboardSummary } from '../hooks/useDashboardSummary';
import { usePortfolioTrend } from '../hooks/usePortfolioTrend';
import { formatCurrency } from '../lib/formatCurrency';

/** Dashboard administrativo — 4 métricas de cartera (spec.md, US1, mockup 1c) + tendencia
 * mensual (specs/003-operational-management/, US3). */
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

      <PortfolioTrendPanel />
    </div>
  );
}

/** Panel de tendencia mensual — capital prestado, recuperado e intereses ganados a lo largo
 * del tiempo (specs/003-operational-management/, US3, FR-008). */
function PortfolioTrendPanel() {
  const { data: trend, isLoading } = usePortfolioTrend();

  return (
    <Card>
      <div className="text-[9.5px] font-bold uppercase tracking-wider text-neutral-400">Tendencia de cartera</div>

      {isLoading ? (
        <p className="mt-3 text-sm text-neutral-500">Cargando…</p>
      ) : !trend || trend.length < 2 ? (
        <p data-testid="trend-limited-history" className="mt-3 text-sm text-neutral-500">
          Todavía no hay suficiente historial para mostrar una tendencia — vuelve cuando tengas actividad en más de un mes.
        </p>
      ) : (
        <div className="mt-3 h-[280px] w-full" data-testid="trend-chart">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="period" tick={{ fontSize: 11 }} stroke="#94A3B8" />
              <YAxis tick={{ fontSize: 11 }} stroke="#94A3B8" tickFormatter={(value: number) => formatCurrency(value)} />
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              <Legend wrapperStyle={{ fontSize: 11.5 }} />
              <Line type="monotone" dataKey="principalLent" name="Capital prestado" stroke="#1E3A8A" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="totalRecovered" name="Total recuperado" stroke="#0F172A" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="interestEarned" name="Intereses ganados" stroke="#10B981" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
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
