import type { Loan, ScoreGrade } from '@repo/core';
import { Badge, Card, ProgressBar } from '@repo/ui/web';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useClientDetail } from '../hooks/useClientDetail';
import { useFormatCurrency } from '../hooks/useFormatCurrency';
import { useUpdateClientNotes } from '../hooks/useUpdateClientNotes';

const GRADE_TONE: Record<ScoreGrade, 'scoreAPlus' | 'scoreA' | 'scoreB' | 'scoreC'> = {
  'A+': 'scoreAPlus',
  A: 'scoreA',
  B: 'scoreB',
  C: 'scoreC',
};

const LOAN_STATUS_LABEL: Record<Loan['status'], string> = {
  active: 'En curso',
  settled: 'Liquidado',
  cancelled: 'Cancelado',
};

/**
 * Perfil completo de un cliente — score, notas e historial completo de préstamos
 * (specs/006-rebrand-currency-polish/, US5). Sin artboard propio en el mockup original (solo
 * existe para mobile, artboard 2c); se construye espejando esa pantalla, adaptada a un layout
 * de escritorio de 2 columnas (research.md §5).
 */
export function ClientProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useClientDetail(id);
  const updateNotes = useUpdateClientNotes(id ?? '');
  const formatCurrency = useFormatCurrency();
  const [notesDraft, setNotesDraft] = useState('');
  const [editingNotes, setEditingNotes] = useState(false);

  useEffect(() => {
    if (data?.client?.privateNotes !== undefined) setNotesDraft(data.client.privateNotes ?? '');
  }, [data?.client?.privateNotes]);

  if (isLoading || !data?.client) {
    return <div className="p-8 text-sm text-neutral-500">Cargando…</div>;
  }

  const { client, score, loans } = data;

  return (
    <div className="flex flex-col gap-5 p-8">
      <div>
        <Link to="/clientes" className="text-xs font-semibold text-brand-navy">
          ← Volver al directorio
        </Link>
        <h1 className="mt-1 font-display text-lg font-bold tracking-tight text-brand-ink">{client.name}</h1>
        <p className="text-xs font-medium text-neutral-400">{client.phone}</p>
      </div>

      <div className="grid grid-cols-[1fr_1.4fr] gap-5">
        <div className="flex flex-col gap-5">
          <Card>
            <div className="mb-2 text-[9.5px] font-bold uppercase tracking-wider text-neutral-400">Score de confianza</div>
            {score?.grade ? (
              <div className="flex items-center gap-2">
                <Badge testID="profile-score-grade" label={score.grade} tone={GRADE_TONE[score.grade]} />
                <span data-testid="profile-score-fraction" className="text-sm text-neutral-500">
                  {score.installmentsPaidOnTime} de {score.installmentsHistorical} cuotas
                </span>
              </div>
            ) : (
              <p data-testid="profile-score-grade" className="text-sm font-bold text-neutral-500">
                Sin historial
              </p>
            )}
          </Card>

          <Card className="bg-[#FFFBEB]">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[9.5px] font-bold uppercase tracking-wider text-[#B45309]">Notas privadas</span>
              {!editingNotes && (
                <button
                  type="button"
                  data-testid="profile-notes-edit"
                  onClick={() => setEditingNotes(true)}
                  className="text-xs font-bold text-brand-navy"
                >
                  Editar
                </button>
              )}
            </div>
            {editingNotes ? (
              <>
                <textarea
                  data-testid="profile-notes-input"
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  placeholder="Sin notas todavía"
                  className="mb-2 w-full rounded-lg border border-[#FDE68A] bg-white p-2 text-sm text-brand-ink"
                />
                <button
                  type="button"
                  data-testid="profile-notes-save"
                  onClick={() => updateNotes.mutate(notesDraft, { onSuccess: () => setEditingNotes(false) })}
                  className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-bold text-brand-ink"
                >
                  {updateNotes.isPending ? 'Guardando…' : 'Guardar nota'}
                </button>
              </>
            ) : (
              <p data-testid="profile-notes-text" className="text-sm text-brand-ink">
                {notesDraft || 'Sin notas todavía'}
              </p>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-3">
          <div className="text-[9.5px] font-bold uppercase tracking-wider text-neutral-400">Historial de préstamos</div>
          {loans.length === 0 ? (
            <p className="text-sm text-neutral-500">Este cliente todavía no tiene préstamos.</p>
          ) : (
            loans.map((loan) => {
              const paid = loan.installments.filter((i) => i.status === 'paid').length;
              const progress = loan.installments.length > 0 ? paid / loan.installments.length : 0;
              return (
                <Card key={loan.id} testID={`profile-loan-${loan.id}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-brand-ink">{formatCurrency(loan.principal)}</span>
                    <Badge label={LOAN_STATUS_LABEL[loan.status]} tone={loan.status === 'active' ? 'cobroHoy' : 'neutral'} />
                  </div>
                  <p className="mt-1 text-xs text-neutral-500">
                    {(loan.interestRate * 100).toFixed(0)}% · {loan.installmentCount} cuotas
                  </p>
                  <div className="mt-2">
                    <ProgressBar value={progress} />
                    <p className="mt-1 text-xs text-neutral-500">
                      {paid} de {loan.installmentCount} cuotas
                    </p>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
