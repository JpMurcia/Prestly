# Core Interfaces: Flexibilidad de Pago Avanzada

Extiende `packages/core/src/interfaces/index.ts` y añade 3 archivos nuevos. Ninguna firma existente de `AmortizationCalculator`, `IInterestStrategy` ni `FlatRateFixedInstallmentStrategy` cambia (constitución Principio I, OCP) — todo lo nuevo compone por encima.

## 1. Meses de gracia — `packages/core/src/domain/graceInstallments.ts`

```typescript
import type { Installment, InstallmentSchedule } from '../interfaces';

export interface GracedInstallment extends Installment {
  /** Fijo desde la estructuración — true si esta cuota fue marcada "de gracia" (spec FR-001). */
  isGrace: boolean;
}

export interface GracedInstallmentSchedule {
  installments: GracedInstallment[];
  /** Idénticos a los del InstallmentSchedule de entrada — la gracia solo redistribuye
   * CUÁNDO se cobra cada monto entre cuotas, nunca CUÁNTO se cobra en total (research.md D1). */
  totalPrincipal: number;
  totalInterest: number;
  totalToPay: number;
}

/** Lanzado si se intenta marcar la última cuota del préstamo como gracia — no existiría una
 * cuota siguiente donde acumular su monto (spec FR-004, research.md D2). */
export class LastInstallmentCannotBeGraceError extends Error {
  constructor() {
    super('La última cuota de un préstamo no puede marcarse como mes de gracia.');
    this.name = 'LastInstallmentCannotBeGraceError';
  }
}

/**
 * Compone sobre el resultado ya calculado de `quoteLoan`/`AmortizationCalculator.calculate`
 * (nunca los modifica — OCP, constitución Principio I). Traslada el capital+interés íntegro de
 * cada cuota marcada en `graceInstallmentNumbers` hacia la cuota `numero + 1`; si hay gracias
 * consecutivas, el monto se sigue acumulando hasta la primera cuota no marcada (research.md D1).
 * Puro, sin I/O.
 *
 * @throws LastInstallmentCannotBeGraceError si `graceInstallmentNumbers` incluye la última cuota.
 */
export function applyGracePeriods(
  schedule: InstallmentSchedule,
  graceInstallmentNumbers: number[]
): GracedInstallmentSchedule;
```

`NewLoan.installments` (interfaces/index.ts) pasa de `Installment[]` a `GracedInstallment[]` — `issueLoan` ya no vuelve a calcular (como hoy), solo persiste lo que `applyGracePeriods` (si hubo gracia) o el `InstallmentSchedule` original (si no) ya produjo. `LoanInstallment` (persistido) gana `isGrace: boolean` junto a los demás campos fijos de la cuota.

## 2. Abono a capital — `packages/core/src/domain/principalContribution.ts`

```typescript
export type PrincipalContributionMode = 'reduce_term' | 'reduce_installment';

export interface PaymentSplit {
  /** Cubre lo exigible de la cuota actual — nunca más que eso (spec FR-005). */
  amountForInstallment: number;
  /** Excedente sobre lo exigible — se aplicará como abono a capital (0 si no hay excedente). */
  principalContribution: number;
}

/**
 * Reemplaza a `registerPayment` en el flujo de UI de "Registrar cobro" (research.md D9) —
 * `registerPayment`/`RegisterPaymentResult` NO se eliminan de `@repo/core`, pero este es el
 * cálculo correcto cuando el monto recibido puede exceder lo exigible: el excedente ya no es
 * "cambio a entregar", es abono a capital. Puro, sin I/O — la persistencia real (incluido el
 * recálculo de la tabla futura) vive en `ILoanRepository.registerInstallmentPayment` →
 * `registrar_cobro` (contracts/data-contract.md).
 */
export function splitPaymentForInstallment(dueAmount: number, receivedAmount: number): PaymentSplit;
```

## 3. Certificado de Paz y Salvo — `packages/core/src/payoff/buildPayoffCertificate.ts`

```typescript
import type { Client, Loan } from '../interfaces';

export interface PayoffCertificateData {
  clientName: string;
  loanId: string;
  /** Ya formateado por quien llama — mismo criterio que buildLoanShareMessage/buildReceiptMessage
   * (@repo/core no formatea moneda ni fecha, spec.md raíz, whatsapp/buildMessages.ts). */
  principalFormatted: string;
  installmentCount: number;
  closingDateFormatted: string;
}

/** Lanzado si se solicita el certificado con saldo distinto de $0.00 (spec FR-009, Edge Cases). */
export class LoanNotFullySettledError extends Error {
  constructor() {
    super('El préstamo todavía tiene saldo pendiente — no se puede generar el Paz y Salvo.');
    this.name = 'LoanNotFullySettledError';
  }
}

export interface BuildPayoffCertificateParams {
  loan: Loan;
  client: Pick<Client, 'name'>;
  /** Formateados por quien llama, mismo criterio que arriba. */
  principalFormatted: string;
  closingDateFormatted: string;
}

/**
 * Construye los datos del certificado — no persiste nada (spec.md Assumptions: se genera bajo
 * demanda). Valida que el saldo restante del préstamo (derivado de `loan.installments`, mismo
 * cálculo que `remainingBalance` ya usado en LoanAmortizationPage) sea exactamente $0.00 antes de
 * construir el documento. La fecha de cierre es el `paidAt` más reciente entre las cuotas del
 * préstamo (derivado, Principio IV — no se almacena una "fecha de cierre" aparte).
 *
 * @throws LoanNotFullySettledError si el saldo restante no es exactamente 0.
 */
export function buildPayoffCertificate(params: BuildPayoffCertificateParams): PayoffCertificateData;
```

`whatsapp/buildMessages.ts` gana `buildPayoffCertificateMessage(data: PayoffCertificateData): string` (mismo archivo, mismo patrón que `buildLoanShareMessage`/`buildReceiptMessage`) para la acción "compartir por WhatsApp" del certificado (spec FR-012, reutiliza `specs/004-whatsapp-automation/`).

## 4. Interfaces existentes extendidas (`packages/core/src/interfaces/index.ts`)

```typescript
// ── Configuración global de la instalación — + modo de abono a capital ─────────────────────
export interface AppSettings {
  currency: CurrencyCode;
  /** Config única de instalación (spec FR-007, research.md D6) — mismo patrón que currency. */
  principalContributionMode: PrincipalContributionMode;
}

export interface IAppSettingsRepository {
  getSettings(): Promise<AppSettings>;
  updateCurrency(currency: CurrencyCode): Promise<AppSettings>;
  updatePrincipalContributionMode(mode: PrincipalContributionMode): Promise<AppSettings>;
}

// ── Préstamos y cuotas — registerInstallmentPayment devuelve más contexto ──────────────────
export interface RegisterInstallmentPaymentResult {
  installment: LoanInstallment;
  /** Cuánto de este cobro se aplicó como abono a capital — 0 si no hubo excedente (spec SC-003). */
  principalContributionApplied: number;
  /** true si, como consecuencia del abono a capital, el préstamo quedó completamente saldado
   * en la misma operación (spec, Historia 2, escenario 5). */
  loanSettled: boolean;
}

export interface ILoanRepository {
  // ...métodos existentes sin cambios...
  /**
   * CAMBIO DE FIRMA respecto a specs/003-operational-management/: devolvía Promise<LoanInstallment>.
   * Ahora devuelve el contexto del abono a capital, si lo hubo — necesario para que la UI muestre
   * "de tu pago de $X, $Y fue abono a capital" DESPUÉS de confirmar (antes de confirmar, la UI usa
   * splitPaymentForInstallment, que es puro y no requiere red).
   */
  registerInstallmentPayment(installmentId: string, amount: number): Promise<RegisterInstallmentPaymentResult>;
}
```

`registerPayment`/`RegisterPaymentResult` (`use-cases/registerPayment.ts`) quedan sin cambios — siguen exportados, ya no son invocados por `RegisterPaymentModal`/`LoanAmortizationPage` (research.md D9).

## 5. `packages/core/src/index.ts` — exports nuevos

```typescript
export { applyGracePeriods, LastInstallmentCannotBeGraceError } from './domain/graceInstallments';
export type { GracedInstallment, GracedInstallmentSchedule } from './domain/graceInstallments';
export { splitPaymentForInstallment } from './domain/principalContribution';
export type { PrincipalContributionMode, PaymentSplit } from './domain/principalContribution';
export { buildPayoffCertificate, LoanNotFullySettledError } from './payoff/buildPayoffCertificate';
export type { PayoffCertificateData, BuildPayoffCertificateParams } from './payoff/buildPayoffCertificate';
export { buildPayoffCertificateMessage } from './whatsapp/buildMessages';
```

## 6. Tests Jest requeridos antes de implementar (constitución Principio III — TDD)

- `graceInstallments.test.ts`: caso de referencia con 2 meses de gracia no consecutivos (cuota 3 y 5 de un préstamo de 12, ver quickstart.md); gracia en la cuota 1 (sin cuota previa); gracias consecutivas (3 y 4); `LastInstallmentCannotBeGraceError` al marcar la cuota 12; `totalPrincipal`/`totalInterest`/`totalToPay` idénticos antes y después.
- `principalContribution.test.ts`: `splitPaymentForInstallment` sin excedente (recibido = exigible), con excedente, con monto menor (pago parcial, `principalContribution = 0`).
- `buildPayoffCertificate.test.ts`: saldo exactamente $0.00 construye el documento; saldo > $0 (incluida una cuota `partial` con $0.01 pendiente) lanza `LoanNotFullySettledError`. La derivación de "qué fecha usar como cierre" (`paidAt` más reciente entre las cuotas) es responsabilidad de quien llama, no de esta función — mismo criterio que `principalFormatted` (research.md, `@repo/core` no formatea ni deriva presentación).
- El caso de referencia de la constitución ($500/15%/12 semanal → cuota $47.92) se re-ejecuta sin cambios como parte de la suite existente — ninguna de las funciones nuevas lo toca.
