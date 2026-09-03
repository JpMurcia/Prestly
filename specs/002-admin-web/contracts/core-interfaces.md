# Contract: Interfaces de `@repo/core` (nuevas y reutilizadas)

Este es el contrato entre `apps/web` y `packages/core` — lo único que la web puede importar para calcular o persistir datos financieros (constitución principios I/II/DIP). Reutiliza tal cual las interfaces de `specs/001-mobile-field-app/contracts/core-interfaces.md` y añade únicamente lo que esa spec no necesitaba: listar todos los préstamos activos y leer el resumen de cartera.

```typescript
// ── Reutilizado sin cambios de specs/001-mobile-field-app/ ──
type PaymentFrequency = 'weekly' | 'biweekly' | 'monthly';

interface LoanInput {
  principal: number;
  interestRate: number;
  installmentCount: number;
  frequency: PaymentFrequency;
  issueDate: Date;
}
interface Installment {
  number: number;
  dueDate: Date;
  principalPortion: number;
  interestPortion: number;
  totalAmount: number;
}
interface InstallmentSchedule {
  installments: Installment[];
  totalPrincipal: number;
  totalInterest: number;
  totalToPay: number;
}
class AmortizationCalculator {
  constructor(private readonly strategy: IInterestStrategy) {}
  calculate(input: LoanInput): InstallmentSchedule;
}

interface ClientFilter {
  search?: string;
  status?: 'todos' | 'cobro_hoy' | 'al_dia' | 'mora';
}
interface IClientReader {
  findById(id: string): Promise<Client | null>;
  list(filter?: ClientFilter): Promise<Client[]>;
  findByPhone(phone: string): Promise<Client | null>;
  getScore(clientId: string): Promise<ClientScore>;
}
interface IClientWriter {
  create(data: NewClient): Promise<Client>;
  update(id: string, data: Partial<Client>): Promise<Client>;
}

// ── ILoanRepository: reutilizada + UN método nuevo (listActive) ──
interface ActiveLoanSummary {
  loan: Loan;
  client: Pick<Client, 'id' | 'name' | 'phone'>;
}

interface ILoanRepository {
  findById(id: string): Promise<Loan | null>;
  save(loan: NewLoan): Promise<Loan>;
  listByClient(clientId: string): Promise<Loan[]>;
  findActiveByClient(clientId: string): Promise<Loan | null>;
  markInstallmentPaid(installmentId: string): Promise<LoanInstallment>;
  listCollectionRoute(referenceDate: Date): Promise<CollectionRouteEntry[]>;
  // NUEVO — US2 (Préstamos activos): sin esto no hay forma de listar préstamos de
  // TODOS los clientes a la vez; los métodos existentes siempre piden un clientId.
  listActive(): Promise<ActiveLoanSummary[]>;
}

// ── NUEVA interfaz — US1 (Dashboard) ──
interface PortfolioSummary {
  principalLent: number;
  totalRecovered: number;
  interestEarned: number;
  overdueAmount: number;
  overdueInstallments: number;
  overdueClients: number;
}

// ISP (constitución Principio I): interfaz separada de ILoanRepository/IClientReader —
// el dashboard solo necesita este agregado de solo-lectura, nada más.
interface IPortfolioReader {
  getSummary(): Promise<PortfolioSummary>;
}
```

## Uso por historia de usuario

| Historia | Interfaces usadas | Notas |
|---|---|---|
| US1 — Dashboard | `IPortfolioReader.getSummary` (NUEVA) | Un solo agregado, refrescado con TanStack Query; ver `research.md` §7 |
| US2 — Préstamos activos + registrar cobro | `ILoanRepository.listActive` (NUEVO método); `ILoanRepository.findById` (abrir un préstamo específico); mutación de cuota vía el mismo método ya existente que usa la app móvil (`markInstallmentPaid`, ver `contracts/data-contract.md`) | El guard de concurrencia (FR-012) ya vive en `registrar_cobro` (RPC) — no se reimplementa aquí, se reutiliza |
| US3 — Directorio/CRM | `IClientReader.list(filter)` (idéntico a spec 001, US3); `IClientReader.getScore` (idéntico a spec 001, US4); `ILoanRepository.listByClient` (para la mini-tabla de amortización del drawer, mockup 2e) | Ningún método nuevo — reutiliza exactamente lo que spec 001 ya construyó para el directorio y el perfil |
| US4 — Cotizar y emitir desde escritorio | `AmortizationCalculator.calculate` (sin red); `IClientReader.list`/`findById`/`findByPhone`; `IClientWriter.create`; `ILoanRepository.save` | Mismos casos de uso de `@repo/core` (`quoteLoan`/`issueLoan`) que ya consume `apps/mobile` — ninguna fórmula se reimplementa (Principio II) |

## Regla de implementación (DIP)

`apps/web` **nunca** importa `@supabase/supabase-js` directamente en una página o hook de UI — solo a través de las implementaciones concretas de estas interfaces, ubicadas en el nuevo paquete compartido `packages/data-supabase` (ver `research.md` §6 y Project Structure de `plan.md`). Las mismas clases (`SupabaseLoanRepository`, `SupabaseClientRepository`) que ya usa `apps/mobile` se reutilizan aquí sin duplicarlas; solo se añade `SupabasePortfolioReader` (nueva, implementa `IPortfolioReader`) y el método `listActive` en `SupabaseLoanRepository`.
