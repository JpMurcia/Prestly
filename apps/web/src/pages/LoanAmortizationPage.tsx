import type { LoanInstallment } from '@repo/core';
import { Badge, Button } from '@repo/ui/web';
import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useLoanAmortization } from '../hooks/useLoanAmortization';
import { useRegisterPayment } from '../hooks/useRegisterPayment';
import { formatCurrency } from '../lib/formatCurrency';

type FilterKey = 'todas' | 'pagadas' | 'pendientes' | 'vence_hoy';

function isDueToday(installment: LoanInstallment): boolean {
  if (installment.status !== 'pending') return false;
  const today = new Date();
  const due = installment.dueDate;
  return (
    due.getFullYear() === today.getFullYear() && due.getMonth() === today.getMonth() && due.getDate() === today.getDate()
  );
}

/** Tabla de amortización extendida de un préstamo — filtros + registrar cobro
 * (spec.md, US2, mockup 1c). */
export function LoanAmortizationPage() {
  const { id } = useParams<{ id: string }>();
  const { data: loan, isLoading } = useLoanAmortization(id);
  const registerPayment = useRegisterPayment();
  const [filter, setFilter] = useState<FilterKey>('todas');

  const filtered = useMemo(() => {
    const installments = loan?.installments ?? [];
    if (filter === 'todas') return installments;
    if (filter === 'pagadas') return installments.filter((i) => i.status === 'paid');
    if (filter === 'vence_hoy') return installments.filter(isDueToday);
    return installments.filter((i) => i.status === 'pending' && !isDueToday(i));
  }, [loan, filter]);

  if (isLoading || !loan) {
    return <p className="p-8 text-sm text-neutral-500">Cargando…</p>;
  }

  const totals = loan.installments.reduce(
    (acc, i) => ({
      principal: acc.principal + i.principalPortion,
      interest: acc.interest + i.interestPortion,
      total: acc.total + i.totalAmount,
    }),
    { principal: 0, interest: 0, total: 0 }
  );

  return (
    <div className="flex flex-col gap-5 p-8">
      <div>
        <h1 className="font-display text-lg font-bold tracking-tight text-brand-ink">
          Tabla de amortización · Préstamo #{loan.id.slice(0, 8)}
        </h1>
        <p className="mt-0.5 text-xs font-medium text-neutral-400">
          {formatCurrency(loan.principal)} · {(loan.interestRate * 100).toFixed(0)}% · {loan.installmentCount} cuotas
        </p>
      </div>

      <div className="flex gap-1 rounded-[9px] bg-neutral-100 p-1 self-start">
        <FilterTab label="Todas" active={filter === 'todas'} onClick={() => setFilter('todas')} />
        <FilterTab label="Pagadas" active={filter === 'pagadas'} onClick={() => setFilter('pagadas')} />
        <FilterTab label="Pendientes" active={filter === 'pendientes'} onClick={() => setFilter('pendientes')} />
        <FilterTab label="Vence hoy" active={filter === 'vence_hoy'} onClick={() => setFilter('vence_hoy')} />
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
              <th className="px-5 text-center">Estado</th>
              <th className="px-5 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((installment) => (
              <tr key={installment.id} className="h-[44px] border-t border-neutral-100">
                <td className="px-5 font-bold text-brand-ink">{String(installment.number).padStart(2, '0')}</td>
                <td className="px-5">{installment.dueDate.toLocaleDateString('es-DO')}</td>
                <td className="px-5 text-right tabular-nums">{formatCurrency(installment.principalPortion)}</td>
                <td className="px-5 text-right tabular-nums">{formatCurrency(installment.interestPortion)}</td>
                <td className="px-5 text-right tabular-nums font-bold text-brand-ink">
                  {formatCurrency(installment.totalAmount)}
                </td>
                <td className="px-5 text-center">
                  {installment.status === 'paid' ? (
                    <Badge label="Pagado" tone="alDia" />
                  ) : isDueToday(installment) ? (
                    <Badge label="Vence hoy" tone="cobroHoy" />
                  ) : (
                    <Badge label="Pendiente" tone="neutral" />
                  )}
                </td>
                <td className="px-5 text-right">
                  {installment.status === 'pending' && (
                    <Button
                      label="Registrar"
                      variant="primary"
                      loading={registerPayment.isPending && registerPayment.variables === installment.id}
                      onPress={() => registerPayment.mutate(installment.id)}
                      className="ml-auto w-fit px-3 py-1.5"
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="h-[44px] border-t border-neutral-200 bg-neutral-50 text-[11.5px] font-semibold text-brand-ink">
              <td className="px-5" colSpan={2}>
                Totales
              </td>
              <td className="px-5 text-right tabular-nums">{formatCurrency(totals.principal)}</td>
              <td className="px-5 text-right tabular-nums">{formatCurrency(totals.interest)}</td>
              <td className="px-5 text-right tabular-nums">{formatCurrency(totals.total)}</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function FilterTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-[7px] px-3.5 py-1.5 text-[11.5px] font-bold',
        active ? 'bg-white text-brand-ink shadow-sm' : 'text-neutral-500',
      ].join(' ')}
    >
      {label}
    </button>
  );
}
