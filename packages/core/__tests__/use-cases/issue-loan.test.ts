import { issueLoan } from '../../src/use-cases/issueLoan';
import { quoteLoan } from '../../src/use-cases/quoteLoan';
import type {
  Client,
  ClientFilter,
  IClientReader,
  IClientWriter,
  ILoanRepository,
  Loan,
  LoanInput,
  NewClient,
  NewLoan,
} from '../../src/interfaces';

/** Fakes en memoria — issueLoan solo depende de las interfaces (DIP), no de Supabase. */
class FakeClientReader implements IClientReader {
  constructor(private readonly clients: Client[]) {}
  async findById(id: string) {
    return this.clients.find((c) => c.id === id) ?? null;
  }
  async list(_filter?: ClientFilter) {
    return this.clients;
  }
  async findByPhone(phone: string) {
    return this.clients.find((c) => c.phone === phone) ?? null;
  }
}

class FakeClientWriter implements IClientWriter {
  public created: NewClient[] = [];
  constructor(private readonly clients: Client[]) {}
  async create(data: NewClient): Promise<Client> {
    this.created.push(data);
    const client: Client = { id: `new-${this.created.length}`, name: data.name, phone: data.phone, address: data.address, createdAt: new Date() };
    this.clients.push(client);
    return client;
  }
  async update(id: string, data: Partial<Client>): Promise<Client> {
    const client = this.clients.find((c) => c.id === id)!;
    Object.assign(client, data);
    return client;
  }
}

class FakeLoanRepository implements ILoanRepository {
  public saved: NewLoan[] = [];
  async findById(): Promise<Loan | null> {
    return null;
  }
  async save(loan: NewLoan): Promise<Loan> {
    this.saved.push(loan);
    return {
      id: 'loan-1',
      ...loan,
      status: 'active',
      installments: loan.installments.map((i, idx) => ({ ...i, id: `installment-${idx + 1}`, status: 'pending' })),
      createdAt: new Date(),
    };
  }
  async listByClient(): Promise<Loan[]> {
    return [];
  }
  async findActiveByClient(): Promise<Loan | null> {
    return null;
  }
  async markInstallmentPaid(): Promise<never> {
    throw new Error('not used in this test');
  }
  async listCollectionRoute(): Promise<never[]> {
    return [];
  }
}

const REFERENCE_INPUT: LoanInput = {
  principal: 500,
  interestRate: 0.15,
  installmentCount: 12,
  frequency: 'weekly',
  issueDate: new Date('2026-07-01T00:00:00.000Z'),
};

describe('issueLoan — Historia 2 de spec.md raíz (US1)', () => {
  it('crea un cliente nuevo y el préstamo con sus cuotas cuando el cliente no existe', async () => {
    const clients: Client[] = [];
    const reader = new FakeClientReader(clients);
    const writer = new FakeClientWriter(clients);
    const loanRepository = new FakeLoanRepository();

    const schedule = quoteLoan(REFERENCE_INPUT);
    const loan = await issueLoan(
      {
        schedule,
        principal: REFERENCE_INPUT.principal,
        interestRate: REFERENCE_INPUT.interestRate,
        installmentCount: REFERENCE_INPUT.installmentCount,
        frequency: REFERENCE_INPUT.frequency,
        issueDate: REFERENCE_INPUT.issueDate,
        client: { newClient: { name: 'Rosa Delgado', phone: '555-0001' } },
      },
      { clientReader: reader, clientWriter: writer, loanRepository }
    );

    expect(writer.created).toHaveLength(1);
    expect(loan.installments).toHaveLength(12);
    expect(loanRepository.saved[0]?.clientId).toBe('new-1');
  });

  it('reutiliza el cliente existente en vez de crear un duplicado si el teléfono ya coincide (guarda anti-duplicado)', async () => {
    const existing: Client = { id: 'client-1', name: 'Rosa Delgado', phone: '555-0001', createdAt: new Date() };
    const clients: Client[] = [existing];
    const reader = new FakeClientReader(clients);
    const writer = new FakeClientWriter(clients);
    const loanRepository = new FakeLoanRepository();

    const schedule = quoteLoan(REFERENCE_INPUT);
    await issueLoan(
      {
        schedule,
        principal: REFERENCE_INPUT.principal,
        interestRate: REFERENCE_INPUT.interestRate,
        installmentCount: REFERENCE_INPUT.installmentCount,
        frequency: REFERENCE_INPUT.frequency,
        issueDate: REFERENCE_INPUT.issueDate,
        client: { newClient: { name: 'Rosa Delgado', phone: '555-0001' } },
      },
      { clientReader: reader, clientWriter: writer, loanRepository }
    );

    expect(writer.created).toHaveLength(0);
    expect(loanRepository.saved[0]?.clientId).toBe('client-1');
  });

  it('emite directamente contra un cliente existente por id, sin tocar el lector/escritor de clientes', async () => {
    const reader = new FakeClientReader([]);
    const writer = new FakeClientWriter([]);
    const loanRepository = new FakeLoanRepository();

    const schedule = quoteLoan(REFERENCE_INPUT);
    await issueLoan(
      {
        schedule,
        principal: REFERENCE_INPUT.principal,
        interestRate: REFERENCE_INPUT.interestRate,
        installmentCount: REFERENCE_INPUT.installmentCount,
        frequency: REFERENCE_INPUT.frequency,
        issueDate: REFERENCE_INPUT.issueDate,
        client: { existingClientId: 'client-99' },
      },
      { clientReader: reader, clientWriter: writer, loanRepository }
    );

    expect(writer.created).toHaveLength(0);
    expect(loanRepository.saved[0]?.clientId).toBe('client-99');
  });
});
