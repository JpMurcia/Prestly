import type { PortfolioStatus } from '@repo/core';
import { Badge, Chip } from '@repo/ui/web';
import { useMemo, useState } from 'react';
import { ClientDetailDrawer } from '../components/ClientDetailDrawer';
import { ExportCsvButton } from '../components/ExportCsvButton';
import { useClientDirectory } from '../hooks/useClientDirectory';
import { formatCurrency } from '../lib/formatCurrency';

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

/** Directorio/CRM de clientes con panel de detalle (spec.md, US3, mockup 2e). */
export function ClientDirectoryPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('todos');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

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
        <ExportCsvButton
          className="ml-auto"
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
          <table className="w-full text-left text-[12.5px]">
            <thead>
              <tr className="h-[38px] bg-neutral-50 text-[9.5px] font-bold uppercase tracking-wider text-neutral-400">
                <th className="px-5">Cliente</th>
                <th className="px-5">Saldo</th>
                <th className="px-5">Estado</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr
                  key={client.id}
                  onClick={() => setSelectedClientId(client.id)}
                  className="h-[56px] cursor-pointer border-t border-neutral-100 hover:bg-neutral-50"
                >
                  <td className="px-5">
                    <div className="font-bold text-brand-ink">{client.name}</div>
                    <div className="text-[10.5px] font-medium text-neutral-400">{client.phone}</div>
                  </td>
                  <td className="px-5 tabular-nums font-bold text-brand-ink">
                    {formatCurrency(client.portfolio?.balance ?? 0)}
                  </td>
                  <td className="px-5">
                    {client.portfolio && (
                      <Badge label={STATUS_BADGE[client.portfolio.status].label} tone={STATUS_BADGE[client.portfolio.status].tone} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selectedClientId && <ClientDetailDrawer clientId={selectedClientId} onClose={() => setSelectedClientId(null)} />}
    </div>
  );
}
