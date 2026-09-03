/**
 * Contrato público de @repo/core. Todo en inglés (constitución §Restricciones técnicas);
 * la capa de infraestructura que implemente estos repositorios (apps/mobile/src/data) es
 * responsable de traducir hacia/desde las columnas en español de spec.md raíz §4.
 */

// ── Cálculo (sin red, sin persistencia) — spec.md raíz §6 ──────────────────

export type PaymentFrequency = 'weekly' | 'biweekly' | 'monthly';

export interface LoanInput {
  principal: number;
  interestRate: number; // 0.15 = 15%
  installmentCount: number;
  frequency: PaymentFrequency;
  issueDate: Date;
}

export interface Installment {
  number: number;
  dueDate: Date;
  principalPortion: number;
  interestPortion: number;
  totalAmount: number;
}

export interface InstallmentSchedule {
  installments: Installment[];
  totalPrincipal: number;
  totalInterest: number;
  totalToPay: number;
}

export interface IInterestStrategy {
  computeInstallments(input: LoanInput): Installment[];
}

// ── Clientes ─────────────────────────────────────────────────────────────

export type PortfolioStatus = 'cobro_hoy' | 'al_dia' | 'mora' | 'sin_prestamo_activo';

export interface ClientPortfolioSummary {
  status: PortfolioStatus;
  balance: number;
  principalLent: number;
  installmentsPaid: number;
  installmentsTotal: number;
  overdueDays?: number;
  nextDueDate?: Date;
  /** Cuota pendiente más próxima — para la acción rápida "Cobrar $X" del directorio (FR-006). */
  nextInstallmentId?: string;
  nextInstallmentAmount?: number;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  address?: string;
  privateNotes?: string;
  notesUpdatedAt?: Date;
  createdAt: Date;
  /** Agregados de cartera derivados de sus préstamos/cuotas — poblados por
   * IClientReader.list()/findById() cuando el caso de uso los necesita (FR-006). */
  portfolio?: ClientPortfolioSummary;
}

export interface NewClient {
  name: string;
  phone: string;
  address?: string;
}

export interface ClientFilter {
  search?: string;
  status?: 'todos' | 'cobro_hoy' | 'al_dia' | 'mora';
}

export type ScoreGrade = 'A+' | 'A' | 'B' | 'C';

export interface ClientScore {
  /** `null` = sin historial (FR-010) — el cliente todavía no tiene cuotas vencidas. */
  grade: ScoreGrade | null;
  installmentsPaidOnTime: number;
  installmentsHistorical: number;
}

export interface IClientReader {
  findById(id: string): Promise<Client | null>;
  list(filter?: ClientFilter): Promise<Client[]>;
  /** Búsqueda exacta por teléfono — guarda anti-duplicado al emitir a un cliente nuevo
   * (data-model.md, edge case de spec.md). */
  findByPhone(phone: string): Promise<Client | null>;
  /** Lee `VIEW cliente_score` (spec.md raíz §4) — grado + fracción, nunca solo la letra (FR-010). */
  getScore(clientId: string): Promise<ClientScore>;
}

export interface IClientWriter {
  create(data: NewClient): Promise<Client>;
  update(id: string, data: Partial<Client>): Promise<Client>;
}

// ── Préstamos y cuotas ───────────────────────────────────────────────────

export type LoanStrategy = 'flatFixedInstallment' | 'french';
export type LoanStatus = 'active' | 'settled' | 'cancelled';
export type InstallmentStatus = 'pending' | 'paid';
export type PaymentMethod = 'cash' | 'transfer';

export interface LoanInstallment extends Installment {
  id: string;
  status: InstallmentStatus;
  paidAt?: Date;
  paidAmount?: number;
}

export interface Loan {
  id: string;
  clientId: string;
  principal: number;
  interestRate: number;
  strategy: LoanStrategy;
  installmentCount: number;
  frequency: PaymentFrequency;
  issueDate: Date;
  status: LoanStatus;
  installments: LoanInstallment[];
  createdAt: Date;
}

/** Forma de un préstamo antes de persistir — sin id (lo asigna la base de datos) ni estado
 * (siempre nace `active`). Ver contracts/core-interfaces.md — ajuste respecto al sketch de
 * spec.md raíz §6 para no depender de generar UUIDs en el cliente. */
export interface NewLoan {
  clientId: string;
  principal: number;
  interestRate: number;
  strategy: LoanStrategy;
  installmentCount: number;
  frequency: PaymentFrequency;
  issueDate: Date;
  installments: Installment[];
}

export interface CollectionRouteEntry {
  installment: LoanInstallment;
  loanId: string;
  /** Total de cuotas del préstamo — para mostrar "cuota N de M" (mockup 2d). */
  installmentCount: number;
  client: Pick<Client, 'id' | 'name' | 'phone'>;
  /** 0 si vence hoy, > 0 días de mora si ya venció (FR-007). */
  overdueDays: number;
}

export interface ILoanRepository {
  findById(id: string): Promise<Loan | null>;
  /** Crea un préstamo nuevo junto con todas sus cuotas de forma atómica (FR-004, US1);
   * devuelve el préstamo persistido con los ids que le asignó la base de datos. */
  save(loan: NewLoan): Promise<Loan>;
  listByClient(clientId: string): Promise<Loan[]>;
  findActiveByClient(clientId: string): Promise<Loan | null>;
  /** Marca una cuota como pagada por su monto exacto (FR-014: sin pagos parciales); falla
   * si ya no está `pending` (guarda de concurrencia, FR-013). */
  markInstallmentPaid(installmentId: string): Promise<LoanInstallment>;
  /** Cuotas vencidas o que vencen hoy de préstamos activos, ordenadas por prioridad (FR-007). */
  listCollectionRoute(referenceDate: Date): Promise<CollectionRouteEntry[]>;
}
