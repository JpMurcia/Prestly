# Contract: Interfaces de `@repo/core` (extendidas)

Contrato entre `apps/mobile`/`apps/web` y `packages/core` — esta fase extiende `ILoanRepository` e `IPortfolioReader` (ya existentes) sin tocar `IClientReader`/`IClientWriter`/`IInterestStrategy`/`AmortizationCalculator` (constitución, ISP).

```typescript
// ── Reutilizado sin cambios ──
type PaymentFrequency = 'weekly' | 'biweekly' | 'monthly';
interface LoanInput { principal: number; interestRate: number; installmentCount: number; frequency: PaymentFrequency; issueDate: Date; }
interface Installment { number: number; dueDate: Date; principalPortion: number; interestPortion: number; totalAmount: number; }
class AmortizationCalculator { constructor(private readonly strategy: IInterestStrategy) {} calculate(input: LoanInput): InstallmentSchedule; }
interface IClientReader { findById(id: string): Promise<Client | null>; list(filter?: ClientFilter): Promise<Client[]>; findByPhone(phone: string): Promise<Client | null>; getScore(clientId: string): Promise<ClientScore>; }
interface IClientWriter { create(data: NewClient): Promise<Client>; update(id: string, data: Partial<Client>): Promise<Client>; }
interface ActiveLoanSummary { loan: Loan; client: Pick<Client, 'id' | 'name' | 'phone'>; }

// ── InstallmentStatus: EXTENDIDO — antes 'pending' | 'paid' ──
type InstallmentStatus = 'pending' | 'partial' | 'paid';

interface LoanInstallment extends Installment {
  id: string;
  status: InstallmentStatus;
  /** Fecha en que llegó a 'paid' — no se mueve con abonos parciales intermedios. */
  paidAt?: Date;
  /** Monto acumulado recibido hasta ahora (0 < paidAmount < totalAmount mientras 'partial'). */
  paidAmount?: number;
}

// ── ILoanRepository: markInstallmentPaid → registerInstallmentPayment; + payoffLoan ──
interface ILoanRepository {
  findById(id: string): Promise<Loan | null>;
  save(loan: NewLoan): Promise<Loan>;
  listByClient(clientId: string): Promise<Loan[]>;
  findActiveByClient(clientId: string): Promise<Loan | null>;
  /**
   * Registra un pago (total o parcial) sobre una cuota pendiente o parcial, por el monto
   * indicado. Un pago total es simplemente `amount` == saldo restante — no hay un método
   * separado para "pagar completo" (US1/US2, FR-001/FR-003/FR-004). Rechaza (guarda de
   * concurrencia) si el monto excede el saldo restante o si la cuota ya no admite pagos.
   * REEMPLAZA a `markInstallmentPaid(installmentId)` de specs/001-002 — mismo procedimiento
   * de base de datos extendido, no uno nuevo en paralelo (research.md §3).
   */
  registerInstallmentPayment(installmentId: string, amount: number): Promise<LoanInstallment>;
  /**
   * Liquida anticipadamente un préstamo activo: paga el saldo restante de todas sus cuotas
   * pendientes/parciales en una sola operación atómica y lo marca `settled` (US2,
   * FR-005/FR-006). El monto exacto a cobrar se deriva ANTES de llamar a este método sumando
   * `totalAmount - (paidAmount ?? 0)` de las cuotas no pagadas del `Loan` ya cargado — no
   * requiere una llamada de red aparte (research.md §2).
   */
  payoffLoan(loanId: string): Promise<Loan>;
  listCollectionRoute(referenceDate: Date): Promise<CollectionRouteEntry[]>;
  listActive(): Promise<ActiveLoanSummary[]>;
}

// ── PortfolioSummary: sin cambios ──
interface PortfolioSummary { principalLent: number; totalRecovered: number; interestEarned: number; overdueAmount: number; overdueInstallments: number; overdueClients: number; }

// ── IPortfolioReader: + getTrend ──
interface PortfolioTrendPoint {
  /** 'YYYY-MM' — un punto por mes calendario con actividad. */
  period: string;
  principalLent: number;
  totalRecovered: number;
  interestEarned: number;
}

interface IPortfolioReader {
  getSummary(): Promise<PortfolioSummary>;
  /** Serie mensual para el panel de tendencia (US3, FR-008). Se añade aquí (no una interfaz
   * nueva) — mismo agregado de solo-lectura de cartera que getSummary, no una operación
   * distinta que justifique una interfaz separada (ISP ya satisfecho por el diseño de
   * specs/002-admin-web/). */
  getTrend(): Promise<PortfolioTrendPoint[]>;
}
```

## Uso por historia de usuario

| Historia | Interfaces usadas | Notas |
|---|---|---|
| US1 — Pago parcial de una cuota | `ILoanRepository.registerInstallmentPayment(id, amount)` (reemplaza `markInstallmentPaid`) | Un solo método para pago total o parcial — `amount` menor al saldo restante es "parcial", igual al saldo restante es "total"; el estado `'partial'`/`'paid'` resultante lo decide el procedimiento de base de datos, no el cliente |
| US2 — Liquidar anticipadamente | `ILoanRepository.payoffLoan(loanId)` (NUEVO); el monto a mostrar antes de confirmar se deriva del `Loan` ya cargado (`findById`), sin un método de "preview" aparte | El guard de concurrencia (FR-007) vive en el mismo procedimiento reutilizado por `registerInstallmentPayment`, no se reimplementa |
| US3 — Tendencia de cartera | `IPortfolioReader.getTrend()` (NUEVO) | Un solo agregado, refrescado con TanStack Query igual que `getSummary` (`specs/002-admin-web/research.md` §7) |

## Regla de implementación (DIP, Principio II)

El reparto capital/interés de un pago parcial y la determinación de si una cuota queda `'partial'` o `'paid'` ocurren **dentro** de la transacción de Postgres que ejecuta `registerInstallmentPayment` — `@repo/core` no reimplementa esa aritmética (no puede participar en la misma transacción atómica) ni la expone como una fórmula pública nueva, porque ningún mockup ni requisito pide mostrársela al prestamista antes de confirmar (`research.md` §2). `@repo/core` sigue siendo la única fuente de las fórmulas de cotización/amortización (`AmortizationCalculator`, sin cambios en esta fase).
