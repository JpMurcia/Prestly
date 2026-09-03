# Contract: Interfaces de `@repo/core`

Este es el contrato entre `apps/mobile` y `packages/core` — lo único que la app puede importar para calcular o persistir datos financieros (constitución principios I/II/DIP). Las firmas reproducen exactamente las de `spec.md` raíz §6; no se añade ni se quita nada aquí, solo se documenta cómo esta feature las invoca.

```typescript
// ── Cálculo (sin red, sin persistencia) — consumido por US1 ──
type PaymentFrequency = 'weekly' | 'biweekly' | 'monthly';

interface LoanInput {
  principal: number;
  interestRate: number;       // 0.15 = 15%
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

interface IInterestStrategy {
  computeInstallments(input: LoanInput): Installment[];
}

class AmortizationCalculator {
  constructor(private readonly strategy: IInterestStrategy) {}
  calculate(input: LoanInput): InstallmentSchedule;
}

// ── Lectura de clientes — consumido por US3 (directorio), US4 (perfil) ──
interface ClientFilter {
  search?: string;               // nombre o teléfono (FR-005)
  status?: 'todos' | 'cobro_hoy' | 'al_dia' | 'mora';
}

interface IClientReader {
  findById(id: string): Promise<Client | null>;
  list(filter?: ClientFilter): Promise<Client[]>;
  // AJUSTE post-diseño: guarda anti-duplicado de data-model.md necesitaba un método formal.
  findByPhone(phone: string): Promise<Client | null>;
  // AJUSTE post-diseño: para mantener DIP (ninguna pantalla importa supabase-js directo),
  // la lectura de `VIEW cliente_score` se expone aquí en vez de "vía la implementación".
  getScore(clientId: string): Promise<ClientScore>;
}

// ── Escritura de clientes — consumido por US1 (alta mínima), US4 (notas) ──
interface IClientWriter {
  create(data: NewClient): Promise<Client>;
  update(id: string, data: Partial<Client>): Promise<Client>;
}

// ── Préstamos — consumido por US1 (emitir), US2 (ruta de cobranza), US4 (historial) ──
interface ILoanRepository {
  findById(id: string): Promise<Loan | null>;
  // AJUSTE post-diseño: devuelve el préstamo persistido (con ids asignados por la base)
  // en vez de void, para no depender de generar UUIDs en el cliente. `NewLoan` es la
  // misma forma sin `id`/`status` (ver packages/core/src/interfaces/index.ts).
  save(loan: NewLoan): Promise<Loan>;
  listByClient(clientId: string): Promise<Loan[]>;
  findActiveByClient(clientId: string): Promise<Loan | null>;
  markInstallmentPaid(installmentId: string): Promise<LoanInstallment>;
  listCollectionRoute(referenceDate: Date): Promise<CollectionRouteEntry[]>;
}
```

**Otro ajuste post-diseño**: `spec.md` raíz §6 solo esbozaba `IClientReader`/`IClientWriter`/`ILoanRepository` como sketch ("Fase 4"). Durante la implementación se añadieron a `ILoanRepository` los métodos `findActiveByClient`, `markInstallmentPaid` y `listCollectionRoute` — no existía una interfaz `ICuotaWriter` separada, así que viven en el mismo repositorio (ver tabla de uso por historia más abajo).

## Uso por historia de usuario

| Historia | Interfaces usadas | Notas |
|---|---|---|
| US1 — Cotizar y emitir | `AmortizationCalculator.calculate` (sin red); `IClientReader.list`/`findById` (buscar existente); `IClientWriter.create` (cliente nuevo); `ILoanRepository.save` (emitir) | `calculate` se llama en cada cambio de slider — debe ser síncrono y determinista |
| US2 — Cobrar en ruta | `ILoanRepository.findById`/`listByClient` (resolver cuotas pendientes); mutación de cuota vía el repositorio (ver `data-contract.md`, no hay una interfaz `ICuotaWriter` separada en `spec.md` raíz — se implementa como método adicional del mismo repositorio) | Requiere conexión (FR-013); ver `contracts/data-contract.md` para el detalle transaccional |
| US3 — Directorio y cartera | `IClientReader.list(filter)` | El filtro por estado (`cobro_hoy`/`al_dia`/`mora`) se resuelve del lado de la implementación concreta, no cambia la firma de la interfaz |
| US4 — Perfil 360° | `IClientReader.findById`; `ILoanRepository.listByClient`; lectura de `VIEW cliente_score` (ver `data-contract.md`); `IClientWriter.update` (notas) | El score no tiene interfaz propia en `spec.md` raíz — se lee directo de la vista SQL vía la implementación del repositorio |

## Regla de implementación (DIP)

`apps/mobile` **nunca** importa `@supabase/supabase-js` directamente en una pantalla o hook de UI — solo a través de la implementación concreta de estas interfaces, ubicada en `apps/mobile/src/data/` (ver Project Structure de `plan.md`). Cambiar de proveedor de base de datos en el futuro no debe tocar ninguna pantalla.
