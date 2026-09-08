import type { PortfolioStatus } from '@repo/core';
import { buildWhatsAppShareLink } from '@repo/core';
import { Badge, Button, Chip, ProgressBar } from '@repo/ui/web';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClientDetailDrawer } from '../components/ClientDetailDrawer';
import { ExportCsvButton } from '../components/ExportCsvButton';
import { NewClientModal } from '../components/NewClientModal';
import { useClientDirectory } from '../hooks/useClientDirectory';
import { useClientDirectoryExtras } from '../hooks/useClientDirectoryExtras';
import { useFormatCurrency } from '../hooks/useFormatCurrency';

type StatusFilter = 'todos' | 'cobro_hoy' | 'al_dia' | 'mora';

const STATUS_FILTER_KEYS: Exclude<StatusFilter, 'todos'>[] = ['cobro_hoy', 'al_dia', 'mora'];
const STATUS_FILTER_LABELS: Record<StatusFilter, string> = {
  todos: 'Todos',
  cobro_hoy: 'Cobranza hoy',
  al_dia: 'Al día',
  mora: 'En mora',
};

const STATUS_BADGE: Record<PortfolioStatus, { label: string; tone: 'alDia' | 'cobroHoy' | 'mora' | 'neutral' }> = {
  al_dia: { label: 'Al día', tone: 'alDia' },
  cobro_hoy: { label: 'Cobro hoy', tone: 'cobroHoy' },
  mora: { label: 'En mora', tone: 'mora' },
  sin_prestamo_activo: { label: 'Sin préstamo activo', tone: 'neutral' },
};

const SCORE_TONE = { 'A+': 'scoreAPlus', A: 'scoreA', B: 'scoreB', C: 'scoreC' } as const;

/** Directorio/CRM de clientes con panel de detalle (spec.md, US3, mockup 2e). Amplía la tabla
 * de 3 a 7 columnas y agrega KPIs/pie de tabla (specs/006-rebrand-currency-polish/, US5). */
export function ClientDirectoryPage() {
  const formatCurrency = useFormatCurrency();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('todos');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [showNewClient, setShowNewClient] = useState(false);

  // El filtro de estado se aplica en memoria (no en la consulta) para poder mostrar el
  // conteo por filtro (FR-005) sin disparar 4 consultas — la cartera es pequeña por diseño
  // (research.md §4, mismo criterio que descartó una librería de tablas).
  const { data, isLoading } = useClientDirectory({ search: search || undefined });

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = { todos: data?.length ?? 0, cobro_hoy: 0, al_dia: 0, mora: 0 };
    for (const client of data ?? []) {
      const s = client.portfolio?.status;
      if (s && STATUS_FILTER_KEYS.includes(s as Exclude<StatusFilter, 'todos'>)) {
        c[s as Exclude<StatusFilter, 'todos'>] += 1;
      }
    }
    return c;
  }, [data]);

  const allMatchingSearch = data ?? [];
  const clients = status === 'todos' ? allMatchingSearch : allMatchingSearch.filter((c) => c.portfolio?.status === status);
  const extras = useClientDirectoryExtras(clients.map((c) => c.id));

  const kpis = useMemo(() => {
    const withActiveLoan = allMatchingSearch.filter((c) => c.portfolio && c.portfolio.status !== 'sin_prestamo_activo');
    const averagePrincipal =
      withActiveLoan.length > 0
        ? withActiveLoan.reduce((acc, c) => acc + (c.portfolio?.principalLent ?? 0), 0) / withActiveLoan.length
        : 0;
    const withLoanCountData = allMatchingSearch.filter((c) => extras[c.id]?.loanCount !== undefined);
    const repeatClients = withLoanCountData.filter((c) => (extras[c.id]?.loanCount ?? 0) > 1);
    const repeatRate = withLoanCountData.length > 0 ? repeatClients.length / withLoanCountData.length : 0;
    return { activeClients: withActiveLoan.length, averagePrincipal, repeatRate };
  }, [allMatchingSearch, extras]);

  const footer = useMemo(() => {
    const totalBalance = clients.reduce((acc, c) => acc + (c.portfolio?.balance ?? 0), 0);
    const withScore = clients.filter((c) => extras[c.id]?.score?.grade);
    const scoreValue = { 'A+': 4, A: 3, B: 2, C: 1 } as const;
    const averageScore =
      withScore.length > 0
        ? withScore.reduce((acc, c) => acc + scoreValue[extras[c.id]!.score!.grade!], 0) / withScore.length
        : null;
    return { totalBalance, averageScore };
  }, [clients, extras]);

  return (
    <div className="flex flex-col gap-5 p-8">
      <div className="flex items-center gap-4">
        <div>
          <h1 className="font-display text-lg font-bold tracking-tight text-brand-ink">Clientes</h1>
          <p className="mt-0.5 text-xs font-medium text-neutral-400">{clients.length} en tu directorio</p>
        </div>
        <input
          type="search"
          placeholder="Buscar cliente o teléfono…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ml-6 max-w-[340px] flex-1 rounded-[9px] border border-neutral-200 bg-neutral-50 px-3 py-2 text-[12.5px] text-brand-ink"
        />
        <div className="ml-auto flex gap-2">
          <Button testID="new-client-open" label="Nuevo cliente" onPress={() => setShowNewClient(true)} />
          <ExportCsvButton
            filename="clientes.csv"
            headers={['Cliente', 'Teléfono', 'Estado', 'Saldo']}
            rows={clients.map((c) => [
              c.name,
              c.phone,
              c.portfolio ? STATUS_BADGE[c.portfolio.status].label : '',
              (c.portfolio?.balance ?? 0).toFixed(2),
            ])}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        <KpiCard label="Clientes activos" value={String(kpis.activeClients)} />
        <KpiCard label="Préstamo promedio" value={formatCurrency(kpis.averagePrincipal)} />
        <KpiCard label="Tasa de reincidencia" value={`${Math.round(kpis.repeatRate * 100)}%`} />
      </div>

      <div className="flex gap-1 self-start rounded-[9px] bg-neutral-100 p-1">
        {(['todos', ...STATUS_FILTER_KEYS] as StatusFilter[]).map((key) => (
          <Chip
            key={key}
            label={`${STATUS_FILTER_LABELS[key]} · ${counts[key]}`}
            selected={status === key}
            onPress={() => setStatus(key)}
          />
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        {isLoading ? (
          <p className="p-6 text-sm text-neutral-500">Cargando…</p>
        ) : clients.length === 0 ? (
          <p className="p-6 text-sm text-neutral-500">Sin resultados para esa búsqueda o filtro.</p>
        ) : (
          <>
            <table className="w-full text-left text-[12.5px]">
              <thead>
                <tr className="h-[38px] bg-neutral-50 text-[9.5px] font-bold uppercase tracking-wider text-neutral-400">
                  <th className="px-5">Cliente</th>
                  <th className="px-5">Préstamos</th>
                  <th className="px-5">Saldo activo</th>
                  <th className="px-5">Comportamiento</th>
                  <th className="px-5">Próximo pago</th>
                  <th className="px-5">Estado</th>
                  <th className="px-5">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => {
                  const extra = extras[client.id];
                  const whatsappLink = buildWhatsAppShareLink(client.phone, '');
                  return (
                    <tr
                      key={client.id}
                      onClick={() => setSelectedClientId(client.id)}
                      className="h-[56px] cursor-pointer border-t border-neutral-100 hover:bg-neutral-50"
                    >
                      <td className="px-5">
                        <div className="font-bold text-brand-ink">{client.name}</div>
                        <div className="text-[10.5px] font-medium text-neutral-400">{client.phone}</div>
                      </td>
                      <td className="px-5 text-neutral-500">
                        {client.portfolio && client.portfolio.status !== 'sin_prestamo_activo' ? 'Activo' : 'Sin préstamo'}
                      </td>
                      <td className="px-5 tabular-nums font-bold text-brand-ink">
                        {formatCurrency(client.portfolio?.balance ?? 0)}
                      </td>
                      <td className="px-5">
                        {extra?.score?.grade ? (
                          <div className="flex items-center gap-2">
                            <Badge label={extra.score.grade} tone={SCORE_TONE[extra.score.grade]} />
                            <ProgressBar
                              className="w-16"
                              value={
                                extra.score.installmentsHistorical > 0
                                  ? extra.score.installmentsPaidOnTime / extra.score.installmentsHistorical
                                  : 0
                              }
                            />
                          </div>
                        ) : (
                          <span className="text-neutral-400">Sin historial</span>
                        )}
                      </td>
                      <td className="px-5 text-neutral-500">
                        {client.portfolio?.nextDueDate ? client.portfolio.nextDueDate.toLocaleDateString('es') : '—'}
                      </td>
                      <td className="px-5">
                        {client.portfolio && (
                          <Badge label={STATUS_BADGE[client.portfolio.status].label} tone={STATUS_BADGE[client.portfolio.status].tone} />
                        )}
                      </td>
                      <td className="px-5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-3">
                          <Link data-testid={`view-profile-${client.id}`} to={`/clientes/${client.id}`} className="text-xs font-bold text-brand-navy">
                            Ver perfil
                          </Link>
                          {whatsappLink && (
                            <a href={whatsappLink} target="_blank" rel="noreferrer" className="text-xs font-bold text-brand-emerald">
                              WA
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="flex items-center justify-between border-t border-neutral-100 px-5 py-3 text-[11.5px] font-semibold text-neutral-500">
              <span>Saldo agregado: {formatCurrency(footer.totalBalance)}</span>
              <span>Score medio: {footer.averageScore ? footer.averageScore.toFixed(1) : '—'}</span>
            </div>
          </>
        )}
      </div>

      {selectedClientId && <ClientDetailDrawer clientId={selectedClientId} onClose={() => setSelectedClientId(null)} />}
      {showNewClient && <NewClientModal onClose={() => setShowNewClient(false)} />}
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="text-[9.5px] font-bold uppercase tracking-wider text-neutral-400">{label}</div>
      <div className="mt-1 font-display text-xl font-extrabold tabular-nums text-brand-ink">{value}</div>
    </div>
  );
}
