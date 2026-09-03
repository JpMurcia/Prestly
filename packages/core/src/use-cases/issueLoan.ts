import type {
  IClientReader,
  IClientWriter,
  ILoanRepository,
  InstallmentSchedule,
  Loan,
  NewClient,
  NewLoan,
  PaymentFrequency,
} from '../interfaces';

export interface IssueLoanDeps {
  clientReader: IClientReader;
  clientWriter: IClientWriter;
  loanRepository: ILoanRepository;
}

export interface IssueLoanInput {
  /** Ya calculado por quoteLoan — issueLoan no vuelve a calcular, solo persiste. */
  schedule: InstallmentSchedule;
  principal: number;
  interestRate: number;
  installmentCount: number;
  frequency: PaymentFrequency;
  issueDate: Date;
  client: { existingClientId: string } | { newClient: NewClient };
}

/**
 * Emitir un préstamo (US1, FR-004; Historia 2 de spec.md raíz). Si el cliente es nuevo,
 * aplica la guarda anti-duplicado por teléfono (data-model.md) antes de crear uno.
 */
export async function issueLoan(input: IssueLoanInput, deps: IssueLoanDeps): Promise<Loan> {
  const clientId = await resolveClientId(input.client, deps);

  const newLoan: NewLoan = {
    clientId,
    principal: input.principal,
    interestRate: input.interestRate,
    strategy: 'flatFixedInstallment',
    installmentCount: input.installmentCount,
    frequency: input.frequency,
    issueDate: input.issueDate,
    installments: input.schedule.installments,
  };

  return deps.loanRepository.save(newLoan);
}

async function resolveClientId(client: IssueLoanInput['client'], deps: IssueLoanDeps): Promise<string> {
  if ('existingClientId' in client) return client.existingClientId;

  const existing = await deps.clientReader.findByPhone(client.newClient.phone);
  if (existing) return existing.id;

  const created = await deps.clientWriter.create(client.newClient);
  return created.id;
}
