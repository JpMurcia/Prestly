import type { Loan, LoanInstallment } from '@repo/core';

export type LoanStatusLabel = 'al_dia' | 'cobro_hoy' | 'mora';

export interface DerivedLoanStatus {
  status: LoanStatusLabel;
  overdueDays?: number;
  balance: number;
  nextInstallment?: LoanInstallment;
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Saldo restante y estado de mora — mismo cálculo derivado que specs/001-mobile-field-app/
 * data-model.md ("Estado derivado — Saldo del préstamo" / "Mora"), reutilizado aquí para que
 * la web muestre exactamente el mismo número, nunca uno recalculado distinto. */
export function deriveLoanStatus(loan: Loan): DerivedLoanStatus {
  const today = startOfToday();

  const balance = loan.installments.reduce((acc, i) => {
    const paid = i.status === 'paid' ? (i.paidAmount ?? i.totalAmount) : 0;
    return acc + (i.totalAmount - paid);
  }, 0);

  const pending = loan.installments
    .filter((i) => i.status === 'pending')
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  const next = pending[0];

  if (!next) {
    return { status: 'al_dia', balance: Math.round(balance * 100) / 100 };
  }

  const diffDays = Math.round((today.getTime() - next.dueDate.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays > 0) {
    return { status: 'mora', overdueDays: diffDays, balance: Math.round(balance * 100) / 100, nextInstallment: next };
  }
  if (diffDays === 0) {
    return { status: 'cobro_hoy', balance: Math.round(balance * 100) / 100, nextInstallment: next };
  }
  return { status: 'al_dia', balance: Math.round(balance * 100) / 100, nextInstallment: next };
}
