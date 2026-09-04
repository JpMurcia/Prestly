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
/** 'partial' = specs/003-operational-management/, US1 — recibió al menos un pago pero no el
 * monto total todavía. */
export type InstallmentStatus = 'pending' | 'partial' | 'paid';
export type PaymentMethod = 'cash' | 'transfer';

export interface LoanInstallment extends Installment {
  id: string;
  status: InstallmentStatus;
  /** Fecha en que llegó a 'paid' — no se mueve con abonos parciales intermedios. */
  paidAt?: Date;
  /** Monto acumulado recibido hasta ahora (0 < paidAmount < totalAmount mientras 'partial'). */
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

/** Un préstamo activo pre-unido a su cliente — evita N+1 al pintar la tabla de "Préstamos
 * activos" de Admin Web (specs/002-admin-web/, US2, mockup 1c). */
export interface ActiveLoanSummary {
  loan: Loan;
  client: Pick<Client, 'id' | 'name' | 'phone'>;
}

export interface ILoanRepository {
  findById(id: string): Promise<Loan | null>;
  /** Crea un préstamo nuevo junto con todas sus cuotas de forma atómica (FR-004, US1);
   * devuelve el préstamo persistido con los ids que le asignó la base de datos. */
  save(loan: NewLoan): Promise<Loan>;
  listByClient(clientId: string): Promise<Loan[]>;
  findActiveByClient(clientId: string): Promise<Loan | null>;
  /**
   * Registra un pago (total o parcial) sobre una cuota pendiente o parcial, por el monto
   * indicado. Un pago total es simplemente `amount` == saldo restante — no hay un método
   * separado para "pagar completo" (specs/003-operational-management/, US1, FR-001/FR-003/
   * FR-004). Rechaza (guarda de concurrencia) si el monto excede el saldo restante o si la
   * cuota ya no admite pagos. REEMPLAZA a `markInstallmentPaid(installmentId)` de
   * specs/001-002 — mismo procedimiento de base de datos extendido, no uno nuevo en paralelo.
   */
  registerInstallmentPayment(installmentId: string, amount: number): Promise<LoanInstallment>;
  /**
   * Liquida anticipadamente un préstamo activo: paga el saldo restante de todas sus cuotas
   * pendientes/parciales en una sola operación atómica y lo marca `settled`
   * (specs/003-operational-management/, US2, FR-005/FR-006). El monto exacto a cobrar se
   * deriva ANTES de llamar a este método sumando `totalAmount - (paidAmount ?? 0)` de las
   * cuotas no pagadas del `Loan` ya cargado — no requiere una llamada de red aparte.
   */
  payoffLoan(loanId: string): Promise<Loan>;
  /** Cuotas vencidas o que vencen hoy de préstamos activos, ordenadas por prioridad (FR-007). */
  listCollectionRoute(referenceDate: Date): Promise<CollectionRouteEntry[]>;
  /** Todos los préstamos activos, de cualquier cliente (specs/002-admin-web/, US2, FR-002) —
   * a diferencia de los métodos de arriba, no requiere conocer un cliente de antemano. */
  listActive(): Promise<ActiveLoanSummary[]>;
}

/** Agregado de cartera derivado de `prestamos`/`cuotas` (specs/002-admin-web/, US1) — nunca
 * almacenado, igual patrón que `ClientScore` (constitución, Principio IV). */
export interface PortfolioSummary {
  principalLent: number;
  totalRecovered: number;
  interestEarned: number;
  overdueAmount: number;
  overdueInstallments: number;
  overdueClients: number;
}

/** Un punto de la serie mensual de tendencia (specs/003-operational-management/, US3,
 * FR-008) — un mes calendario con actividad de préstamos y/o cobros. */
export interface PortfolioTrendPoint {
  /** 'YYYY-MM' */
  period: string;
  principalLent: number;
  totalRecovered: number;
  interestEarned: number;
}

// ISP (constitución Principio I): interfaz separada de ILoanRepository/IClientReader — el
// dashboard solo necesita este agregado de solo-lectura, nada de las demás operaciones.
export interface IPortfolioReader {
  getSummary(): Promise<PortfolioSummary>;
  /** Serie mensual para el panel de tendencia (specs/003-operational-management/, US3,
   * FR-008). Se añade aquí (no una interfaz nueva) — mismo agregado de solo-lectura de
   * cartera que getSummary, no una operación distinta que justifique ISP separado. */
  getTrend(): Promise<PortfolioTrendPoint[]>;
}

// ── Automatización WhatsApp (specs/004-whatsapp-automation/) ───────────────

export type WhatsAppNotificationType = 'reminder' | 'overdue';
export type WhatsAppNotificationResult = 'sent' | 'simulated' | 'failed';

/** Una fila del historial de la revisión automática (Historia 1) — nunca generada por las
 * acciones manuales de compartir (Historia 3), que no pasan por esta tabla. */
export interface WhatsAppNotification {
  id: string;
  installmentId: string;
  clientId: string;
  type: WhatsAppNotificationType;
  result: WhatsAppNotificationResult;
  detail: string | null;
  createdAt: Date;
}

export interface WhatsAppConfigStatus {
  connected: boolean;
  /** Solo el número de envío (no es secreto) — nunca el Account SID ni el Auth Token
   * (FR-005: una vez guardada, la credencial no se vuelve a mostrar completa). */
  fromNumber: string | null;
}

/**
 * Configurar/consultar la conexión con Twilio (specs/004-whatsapp-automation/, Historia 2).
 * A diferencia de IClientReader/IClientWriter, no se separa lectura de escritura aquí — hoy
 * existe un único consumidor real (la pantalla de configuración) que siempre necesita ambas
 * mitades juntas; separarlas sería una abstracción sin un segundo consumidor que la
 * justifique (YAGNI, ver plan.md §Constitution Check).
 */
export interface IWhatsAppConfigRepository {
  getStatus(): Promise<WhatsAppConfigStatus>;
  saveCredentials(accountSid: string, authToken: string, fromNumber: string): Promise<void>;
  clearCredentials(): Promise<void>;
}

// ISP: separada de IWhatsAppConfigRepository — el historial (Historia 1) puede tener un
// consumidor distinto de la pantalla de configuración (Historia 2), a diferencia de esta.
export interface IWhatsAppNotificationHistoryReader {
  list(): Promise<WhatsAppNotification[]>;
}
