import { buildPayoffCertificate, LoanNotFullySettledError } from '../../src/payoff/buildPayoffCertificate';
import type { Loan, LoanInstallment } from '../../src/interfaces';

function makeInstallment(overrides: Partial<LoanInstallment>): LoanInstallment {
  return {
    id: 'inst-1',
    number: 1,
    dueDate: new Date('2026-01-08T00:00:00.000Z'),
    principalPortion: 41.67,
    interestPortion: 6.25,
    totalAmount: 47.92,
    status: 'paid',
    paidAmount: 47.92,
    isGrace: false,
    ...overrides,
  };
}

function makeLoan(installments: LoanInstallment[]): Loan {
  return {
    id: 'loan-1',
    clientId: 'client-1',
    principal: 500,
    interestRate: 0.15,
    strategy: 'flatFixedInstallment',
    installmentCount: installments.length,
    frequency: 'weekly',
    issueDate: new Date('2026-01-01T00:00:00.000Z'),
    status: 'settled',
    installments,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };
}

/**
 * specs/008-flexible-repayment-features, US3 — constitución principio III (Test-First): este
 * test debe existir y fallar antes de que exista buildPayoffCertificate. `principalFormatted`/
 * `closingDateFormatted` llegan ya formateados por quien llama (contracts/core-interfaces.md §3,
 * mismo criterio que buildLoanShareMessage/buildReceiptMessage) — este test no verifica formato
 * de moneda/fecha, solo la validación de saldo $0.00 y el armado del documento.
 */
describe('buildPayoffCertificate — specs/008-flexible-repayment-features, US3', () => {
  it('construye el certificado cuando el saldo restante es exactamente $0.00 (spec FR-009)', () => {
    const loan = makeLoan([
      makeInstallment({ number: 1 }),
      makeInstallment({ id: 'inst-2', number: 2 }),
    ]);

    const certificate = buildPayoffCertificate({
      loan,
      client: { name: 'Rosa Delgado' },
      principalFormatted: '500,00',
      closingDateFormatted: '15/01/2026',
    });

    expect(certificate).toEqual({
      clientName: 'Rosa Delgado',
      loanId: 'loan-1',
      principalFormatted: '500,00',
      installmentCount: 2,
      closingDateFormatted: '15/01/2026',
    });
  });

  it('lanza LoanNotFullySettledError si todavía hay una cuota pendiente (Edge Cases)', () => {
    const loan = makeLoan([
      makeInstallment({ number: 1, status: 'paid', paidAmount: 47.92 }),
      makeInstallment({ id: 'inst-2', number: 2, status: 'pending', paidAmount: undefined }),
    ]);

    expect(() =>
      buildPayoffCertificate({ loan, client: { name: 'Rosa Delgado' }, principalFormatted: '500,00', closingDateFormatted: '15/01/2026' })
    ).toThrow(LoanNotFullySettledError);
  });

  it('lanza LoanNotFullySettledError incluso con un saldo residual de $0.01 (redondeo, no un caso especial)', () => {
    const loan = makeLoan([
      makeInstallment({ number: 1, status: 'partial', totalAmount: 47.92, paidAmount: 47.91 }),
    ]);

    expect(() =>
      buildPayoffCertificate({ loan, client: { name: 'Rosa Delgado' }, principalFormatted: '500,00', closingDateFormatted: '15/01/2026' })
    ).toThrow(LoanNotFullySettledError);
  });

  it('un préstamo sin cuotas (caso degenerado) se considera saldado — saldo $0.00 vacuo', () => {
    const loan = makeLoan([]);

    expect(() =>
      buildPayoffCertificate({ loan, client: { name: 'Rosa Delgado' }, principalFormatted: '0,00', closingDateFormatted: '15/01/2026' })
    ).not.toThrow();
  });
});
