import type { LoanInstallment } from '@repo/core';
import { buildPayoffCertificate, buildPayoffCertificateMessage, buildReceiptMessage, buildWhatsAppShareLink, splitPaymentForInstallment } from '@repo/core';
import { Badge, Button } from '@repo/ui/web';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { clientRepository } from '../data/repositories';
import { PayoffCertificateView } from '../components/PayoffCertificateView';
import { useFormatCurrency } from '../hooks/useFormatCurrency';
import { useLoanAmortization } from '../hooks/useLoanAmortization';
import { useRegisterPayment } from '../hooks/useRegisterPayment';
import { usePayoffLoan } from '../hooks/usePayoffLoan';

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

/** Fecha de cierre del Certificado de Paz y Salvo — el `paidAt` más reciente entre las cuotas
 * (derivado, no se persiste aparte; specs/008-flexible-repayment-features/, US3, contracts/
 * core-interfaces.md §3: esta derivación es responsabilidad de quien llama, no de @repo/core). */
function closingDate(installments: LoanInstallment[]): Date | null {
  const paidDates = installments.map((i) => i.paidAt).filter((d): d is Date => d !== undefined);
  if (paidDates.length === 0) return null;
  return new Date(Math.max(...paidDates.map((d) => d.getTime())));
}

/** Tabla de amortización extendida de un préstamo — filtros, registrar cobro (total o
 * parcial) y liquidación anticipada (spec.md, US2 de specs/002-admin-web/, mockup 1c;
 * specs/003-operational-management/, US1/US2). */
export function LoanAmortizationPage() {
  const formatCurrency = useFormatCurrency();
  const { id } = useParams<{ id: string }>();
  const { data: loan, isLoading } = useLoanAmortization(id);
  const { data: client } = useQuery({
    queryKey: ['loanClient', loan?.clientId],
    queryFn: () => clientRepository.findById(loan!.clientId),
    enabled: !!loan,
  });
  const registerPayment = useRegisterPayment();
  const payoffLoan = usePayoffLoan();
  const [filter, setFilter] = useState<FilterKey>('todas');
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [showCertificate, setShowCertificate] = useState(false);

  const filtered = useMemo(() => {
    const installments = loan?.installments ?? [];
    if (filter === 'todas') return installments;
    // Una cuota de gracia nace 'paid' (specs/008-flexible-repayment-features/, D8) pero nunca
    // se cobró de verdad — no cuenta como "pagada" para este filtro (research.md D8).
    if (filter === 'pagadas') return installments.filter((i) => i.status === 'paid' && !i.isGrace);
    if (filter === 'vence_hoy') return installments.filter(isDueToday);
    return installments.filter((i) => i.status !== 'paid' && !isDueToday(i));
  }, [loan, filter]);

  // Conteo por filtro (specs/006-rebrand-currency-polish/, US5; REPORT.md hallazgo
  // "boton"/cosmético) — mismo criterio que los Chip de filtro de ClientDirectoryPage.
  const filterCounts = useMemo(() => {
    const installments = loan?.installments ?? [];
    return {
      todas: installments.length,
      pagadas: installments.filter((i) => i.status === 'paid' && !i.isGrace).length,
      vence_hoy: installments.filter(isDueToday).length,
      pendientes: installments.filter((i) => i.status !== 'paid' && !isDueToday(i)).length,
    };
  }, [loan]);

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

  const loanBalance = Math.round((loan.installments.reduce((acc, i) => acc + remainingBalance(i), 0) + Number.EPSILON) * 100) / 100;
  const canPayoff = loan.status === 'active' && loanBalance > 0;
  // specs/008-flexible-repayment-features/, US3, FR-009 — saldo $0.00 exacto habilita el
  // certificado, sin importar cómo se llegó ahí (plazo normal, liquidación anticipada o abono a
  // capital); loan.status puede seguir 'active' si se saldó por plazo normal sin liquidar_prestamo.
  const canGenerateCertificate = loanBalance === 0;

  const payoffCertificateData =
    canGenerateCertificate && client
      ? buildPayoffCertificate({
          loan,
          client,
          principalFormatted: formatCurrency(loan.principal),
          closingDateFormatted: (closingDate(loan.installments) ?? new Date()).toLocaleDateString('es-DO'),
        })
      : null;

  const certificateShareLink =
    client && payoffCertificateData
      ? buildWhatsAppShareLink(client.phone, buildPayoffCertificateMessage(payoffCertificateData))
      : null;

  const receiptShareLink = (installment: LoanInstallment): string | null => {
    if (!client) return null;
    const paid = installment.paidAmount ?? installment.totalAmount;
    const message = buildReceiptMessage({
      clientName: client.name,
      installmentNumber: installment.number,
      installmentCount: loan.installmentCount,
      amountReceivedFormatted: formatCurrency(paid).replace('$', ''),
      isFullyPaid: installment.status === 'paid',
      remainingBalanceFormatted:
        installment.status === 'partial' ? formatCurrency(remainingBalance(installment)).replace('$', '') : undefined,
    });
    return buildWhatsAppShareLink(client.phone, message);
  };

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
        {canGenerateCertificate && (
          <Button
            testID="generate-payoff-certificate"
            label="Generar Paz y Salvo"
            onPress={() => setShowCertificate(true)}
            className="w-fit px-3 py-1.5"
          />
        )}
      </div>

      {showCertificate && payoffCertificateData && (
        <PayoffCertificateView
          data={payoffCertificateData}
          shareLink={certificateShareLink}
          onClose={() => setShowCertificate(false)}
        />
      )}

      <div className="flex gap-1 rounded-[9px] bg-neutral-100 p-1 self-start">
        <FilterTab label={`Todas · ${filterCounts.todas}`} active={filter === 'todas'} onClick={() => setFilter('todas')} />
        <FilterTab label={`Pagadas · ${filterCounts.pagadas}`} active={filter === 'pagadas'} onClick={() => setFilter('pagadas')} />
        <FilterTab
          label={`Pendientes · ${filterCounts.pendientes}`}
          active={filter === 'pendientes'}
          onClick={() => setFilter('pendientes')}
        />
        <FilterTab label={`Vence hoy · ${filterCounts.vence_hoy}`} active={filter === 'vence_hoy'} onClick={() => setFilter('vence_hoy')} />
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
              <th className="px-5 text-right">Saldo restante</th>
              <th className="px-5 text-center">Estado</th>
              <th className="px-5 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((installment) => (
              <tr key={installment.id} className="h-[44px] border-t border-neutral-100">
                <td className="px-5 font-bold text-brand-ink">{String(installment.number).padStart(2, '0')}</td>
                <td className="px-5">{installment.dueDate.toLocaleDateString('es-DO')}</td>
                {installment.isGrace ? (
                  <td className="px-5 text-right text-[11px] font-semibold text-neutral-400" colSpan={4}>
                    Sin cobro — interés acumulado en la cuota siguiente
                  </td>
                ) : (
                  <>
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
                    <td className="px-5 text-right tabular-nums text-neutral-500">
                      {formatCurrency(installment.status === 'paid' ? 0 : remainingBalance(installment))}
                    </td>
                  </>
                )}
                <td className="px-5 text-center">
                  {installment.isGrace ? (
                    <Badge label="Gracia" tone="neutral" />
                  ) : installment.status === 'paid' ? (
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
                  <div className="ml-auto flex w-fit flex-col items-end gap-1">
                    <div className="flex items-center gap-1.5">
                      {installment.status !== 'paid' && (
                        <>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
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
                        </>
                      )}
                    </div>
                    {installment.status !== 'paid' &&
                      splitPaymentForInstallment(remainingBalance(installment), amountFor(installment)).principalContribution >
                        0 && (
                        <span
                          data-testid={`principal-contribution-hint-${installment.number}`}
                          className="rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700"
                        >
                          Excedente de{' '}
                          {formatCurrency(
                            splitPaymentForInstallment(remainingBalance(installment), amountFor(installment)).principalContribution
                          )}{' '}
                          irá a Abono a Capital
                        </span>
                      )}
                    {!installment.isGrace && (installment.status === 'paid' || installment.status === 'partial') && (
                      <a
                        data-testid={`whatsapp-receipt-${installment.number}`}
                        href={receiptShareLink(installment) ?? undefined}
                        target="_blank"
                        rel="noreferrer"
                        aria-disabled={!receiptShareLink(installment)}
                        title={!receiptShareLink(installment) ? 'Este cliente no tiene un teléfono utilizable' : undefined}
                        onClick={(e) => {
                          if (!receiptShareLink(installment)) e.preventDefault();
                        }}
                        className={[
                          'rounded-lg border border-neutral-200 px-2.5 py-1.5 text-[11px] font-bold',
                          receiptShareLink(installment) ? 'text-emerald-700 hover:bg-emerald-50' : 'cursor-not-allowed text-neutral-300',
                        ].join(' ')}
                      >
                        WhatsApp
                      </a>
                    )}
                  </div>
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
              <td className="px-5 text-right tabular-nums">{formatCurrency(loanBalance)}</td>
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
