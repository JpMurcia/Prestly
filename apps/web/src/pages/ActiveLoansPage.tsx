import { Badge } from '@repo/ui/web';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExportCsvButton } from '../components/ExportCsvButton';
import { useActiveLoans } from '../hooks/useActiveLoans';
import { useFormatCurrency } from '../hooks/useFormatCurrency';
import { deriveLoanStatus, type LoanStatusLabel } from '../lib/loanStatus';

const STATUS_LABEL: Record<LoanStatusLabel, string> = {
  al_dia: 'Al día',
  cobro_hoy: 'Cobro hoy',
  mora: 'En mora',
};

const STATUS_TONE: Record<LoanStatusLabel, 'alDia' | 'cobroHoy' | 'mora'> = {
  al_dia: 'alDia',
  cobro_hoy: 'cobroHoy',
  mora: 'mora',
};

/** Préstamos activos — lista buscable + exportable (spec.md, US2, mockup 1c). */
export function ActiveLoansPage() {
  const { data, isLoading } = useActiveLoans();
  const formatCurrency = useFormatCurrency();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const loans = data ?? [];
    if (!term) return loans;
    return loans.filter(
      (summary) =>
        summary.client.name.toLowerCase().includes(term) ||
        summary.client.phone.toLowerCase().includes(term) ||
        summary.loan.id.toLowerCase().includes(term)
    );
  }, [data, search]);

  return (
    <div className="flex flex-col gap-5 p-8">
      <div className="flex items-center gap-4">
        <div>
          <h1 className="font-display text-lg font-bold tracking-tight text-brand-ink">Préstamos activos</h1>
          <p className="mt-0.5 text-xs font-medium text-neutral-400">Cartera de {data?.length ?? 0} préstamos</p>
        </div>
        <input
          type="search"
          placeholder="Buscar cliente, préstamo o teléfono…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ml-6 max-w-[340px] flex-1 rounded-[9px] border border-neutral-200 bg-neutral-50 px-3 py-2 text-[12.5px] text-brand-ink"
        />
        <ExportCsvButton
          className="ml-auto"
          filename="prestamos-activos.csv"
          headers={['Cliente', 'Teléfono', 'Capital', 'Saldo', 'Estado']}
          rows={filtered.map((s) => {
            const derived = deriveLoanStatus(s.loan);
            return [s.client.name, s.client.phone, s.loan.principal.toFixed(2), derived.balance.toFixed(2), STATUS_LABEL[derived.status]];
          })}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        {isLoading ? (
          <p className="p-6 text-sm text-neutral-500">Cargando…</p>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-sm text-neutral-500">
            {data?.length === 0 ? 'Todavía no tienes préstamos activos.' : 'Sin resultados para esa búsqueda.'}
          </p>
        ) : (
          <table className="w-full text-left text-[12.5px]">
            <thead>
              <tr className="h-[38px] bg-neutral-50 text-[9.5px] font-bold uppercase tracking-wider text-neutral-400">
                <th className="px-5">Cliente</th>
                <th className="px-5">Capital</th>
                <th className="px-5">Saldo</th>
                <th className="px-5">Estado</th>
                <th className="px-5" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(({ loan, client }) => {
                const derived = deriveLoanStatus(loan);
                return (
                  <tr key={loan.id} className="h-[56px] border-t border-neutral-100">
                    <td className="px-5">
                      <div className="font-bold text-brand-ink">{client.name}</div>
                      <div className="text-[10.5px] font-medium text-neutral-400">{client.phone}</div>
                    </td>
                    <td className="px-5 tabular-nums">{formatCurrency(loan.principal)}</td>
                    <td className="px-5 tabular-nums font-bold text-brand-ink">{formatCurrency(derived.balance)}</td>
                    <td className="px-5">
                      <Badge label={STATUS_LABEL[derived.status]} tone={STATUS_TONE[derived.status]} />
                    </td>
                    <td className="px-5 text-right">
                      <Link to={`/prestamos/${loan.id}`} className="font-bold text-brand-navy">
                        Ver amortización
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
