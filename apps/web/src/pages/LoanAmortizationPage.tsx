import type { LoanInstallment } from '@repo/core';
import { Badge, Button } from '@repo/ui/web';
import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useLoanAmortization } from '../hooks/useLoanAmortization';
import { useRegisterPayment } from '../hooks/useRegisterPayment';
import { usePayoffLoan } from '../hooks/usePayoffLoan';
import { formatCurrency } from '../lib/formatCurrency';

type FilterKey = 'todas' | 'pagadas' | 'pendientes' | 'vence_hoy';

function isDueToday(installment: LoanInstallment): boolean {
  if (installment.status === 'paid') return false;
  const today = new Date();
  const due = installment.dueDate;
  return (
    due.getFullYear() === today.getFullYear() && due.getMonth() === today.getMonth() && due.getDate() === today.getDate()
  );
}

function remainingBalance(installment: LoanInstallment): number {
  // Redondeado — restar dos NUMERIC de Postgres ya pasados por punto flotante de JS puede
  // dar p.ej. 7.920000000000002 en vez de 7.92 (encontrado en verificación manual, filtraba
  // hasta el <input> de monto).
  return Math.round((installment.totalAmount - (installment.paidAmount ?? 0) + Number.EPSILON) * 100) / 100;
}

/** Tabla de amortización extendida de un préstamo — filtros, registrar cobro (total o
 * parcial) y liquidación anticipada (spec.md, US2 de specs/002-admin-web/, mockup 1c;
 * specs/003-operational-management/, US1/US2). */
export function LoanAmortizationPage() {
  const { id } = useParams<{ id: string }>();
  const { data: loan, isLoading } = useLoanAmortization(id);
  const registerPayment = useRegisterPayment();
  const payoffLoan = usePayoffLoan();
  const [filter, setFilter] = useState<FilterKey>('todas');
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  const filtered = useMemo(() => {
    const installments = loan?.installments ?? [];
    if (filter === 'todas') return installments;
    if (filter === 'pagadas') return installments.filter((i) => i.status === 'paid');
    if (filter === 'vence_hoy') return installments.filter(isDueToday);
    return installments.filter((i) => i.status !== 'paid' && !isDueToday(i));
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

  const loanBalance = loan.installments.reduce((acc, i) => acc + remainingBalance(i), 0);
  const canPayoff = loan.status === 'active' && loanBalance > 0;

  function amountFor(installment: LoanInstallment): number {
    const raw = amounts[installment.id];
    if (raw === undefined) return remainingBalance(installment);
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function handleRegister(installment: LoanInstallment) {
    registerPayment.mutate(
      { installmentId: installment.id, amount: amountFor(installment) },
      {
        // Limpia el monto capturado para esta fila — sin esto, un segundo registro sobre la
        // misma cuota (ej. completar un pago parcial) reenviaría el valor viejo en vez de
        // recalcular el nuevo saldo restante ya actualizado.
        onSuccess: () => setAmounts((prev) => {
          const next = { ...prev };
          delete next[installment.id];
          return next;
        }),
      }
    );
  }

  async function handlePayoff() {
    if (!id) return;
    if (!window.confirm(`Se cobrará el saldo restante de ${formatCurrency(loanBalance)} y el préstamo quedará liquidado. ¿Confirmar?`)) {
      return;
    }
    try {
      await payoffLoan.mutateAsync(id);
    } catch {
      window.alert('No se pudo liquidar el préstamo. Puede que ya se haya liquidado desde otra sesión.');
    }
  }

  return (
    <div className="flex flex-col gap-5 p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-lg font-bold tracking-tight text-brand-ink">
            Tabla de amortización · Préstamo #{loan.id.slice(0, 8)}
          </h1>
          <p className="mt-0.5 text-xs font-medium text-neutral-400">
            {formatCurrency(loan.principal)} · {(loan.interestRate * 100).toFixed(0)}% · {loan.installmentCount} cuotas
          </p>
        </div>
        {canPayoff && (
          <Button
            label={payoffLoan.isPending ? 'Liquidando…' : `Liquidar anticipadamente (${formatCurrency(loanBalance)})`}
            variant="secondary"
            loading={payoffLoan.isPending}
            onPress={handlePayoff}
            className="w-fit px-3 py-1.5"
          />
        )}
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
                  {installment.status === 'partial' && (
                    <div className="text-[10px] font-medium text-neutral-400">
                      faltan {formatCurrency(remainingBalance(installment))}
                    </div>
                  )}
                </td>
                <td className="px-5 text-center">
                  {installment.status === 'paid' ? (
                    <Badge label="Pagado" tone="alDia" />
                  ) : installment.status === 'partial' ? (
                    <Badge label="Parcial" tone="neutral" />
                  ) : isDueToday(installment) ? (
                    <Badge label="Vence hoy" tone="cobroHoy" />
                  ) : (
                    <Badge label="Pendiente" tone="neutral" />
                  )}
                </td>
                <td className="px-5 text-right">
                  {installment.status !== 'paid' && (
                    <div className="ml-auto flex w-fit items-center gap-1.5">
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={remainingBalance(installment)}
                        aria-label={`Monto a registrar para la cuota ${installment.number}`}
                        value={amounts[installment.id] ?? String(remainingBalance(installment))}
                        onChange={(e) => setAmounts((prev) => ({ ...prev, [installment.id]: e.target.value }))}
                        className="w-20 rounded-md border border-neutral-200 px-2 py-1 text-right text-[11.5px] tabular-nums"
                      />
                      <Button
                        label="Registrar"
                        variant="primary"
                        loading={registerPayment.isPending && registerPayment.variables?.installmentId === installment.id}
                        onPress={() => handleRegister(installment)}
                        className="w-fit px-3 py-1.5"
                      />
                    </div>
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
