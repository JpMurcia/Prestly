import type {
  ActiveLoanSummary,
  CollectionRouteEntry,
  ILoanRepository,
  InstallmentStatus,
  Loan,
  LoanInstallment,
  LoanStatus,
  LoanStrategy,
  NewLoan,
  PaymentFrequency,
} from '@repo/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fromDateOnly, toDateOnly } from './dateOnly';

// ── Mapeo inglés (dominio) ⇄ español (columnas de spec.md raíz §4) ─────────────

const STRATEGY_TO_DB: Record<LoanStrategy, string> = {
  flatFixedInstallment: 'simple_cuota_fija',
  french: 'frances',
};
const STRATEGY_FROM_DB: Record<string, LoanStrategy> = {
  simple_cuota_fija: 'flatFixedInstallment',
  frances: 'french',
};

const STATUS_FROM_DB: Record<string, LoanStatus> = {
  activo: 'active',
  liquidado: 'settled',
  cancelado: 'cancelled',
};

const FREQUENCY_TO_DB: Record<PaymentFrequency, string> = {
  weekly: 'semanal',
  biweekly: 'quincenal',
  monthly: 'mensual',
};
const FREQUENCY_FROM_DB: Record<string, PaymentFrequency> = {
  semanal: 'weekly',
  quincenal: 'biweekly',
  mensual: 'monthly',
};

const INSTALLMENT_STATUS_FROM_DB: Record<string, InstallmentStatus> = {
  pendiente: 'pending',
  pagado: 'paid',
};

interface CuotaRow {
  id: string;
  numero: number;
  fecha_vencimiento: string;
  monto_capital: number;
  monto_interes: number;
  monto_cuota: number;
  estado: 'pendiente' | 'pagado';
  fecha_pago: string | null;
  monto_pagado: number | null;
}

interface PrestamoRow {
  id: string;
  cliente_id: string;
  capital: number;
  tasa_interes: number;
  estrategia: string;
  num_cuotas: number;
  frecuencia: string;
  fecha_emision: string;
  estado: string;
  creado_en: string;
  cuotas: CuotaRow[] | null;
}

interface PrestamoActivoConClienteRow extends PrestamoRow {
  clientes: { id: string; nombre: string; telefono: string };
}

const PRESTAMO_CON_CUOTAS_SELECT =
  'id, cliente_id, capital, tasa_interes, estrategia, num_cuotas, frecuencia, fecha_emision, estado, creado_en, cuotas(*)';

const PRESTAMO_ACTIVO_CON_CLIENTE_SELECT =
  'id, cliente_id, capital, tasa_interes, estrategia, num_cuotas, frecuencia, fecha_emision, estado, creado_en, ' +
  'cuotas(*), clientes(id, nombre, telefono)';

function toLoanInstallment(row: CuotaRow): LoanInstallment {
  return {
    id: row.id,
    number: row.numero,
    dueDate: fromDateOnly(row.fecha_vencimiento),
    principalPortion: row.monto_capital,
    interestPortion: row.monto_interes,
    totalAmount: row.monto_cuota,
    status: INSTALLMENT_STATUS_FROM_DB[row.estado] ?? 'pending',
    paidAt: row.fecha_pago ? new Date(row.fecha_pago) : undefined,
    paidAmount: row.monto_pagado ?? undefined,
  };
}

function toLoan(row: PrestamoRow): Loan {
  const installments = (row.cuotas ?? [])
    .map(toLoanInstallment)
    .sort((a, b) => a.number - b.number);

  return {
    id: row.id,
    clientId: row.cliente_id,
    principal: row.capital,
    interestRate: row.tasa_interes,
    strategy: STRATEGY_FROM_DB[row.estrategia] ?? 'flatFixedInstallment',
    installmentCount: row.num_cuotas,
    frequency: FREQUENCY_FROM_DB[row.frecuencia] ?? 'weekly',
    issueDate: fromDateOnly(row.fecha_emision),
    status: STATUS_FROM_DB[row.estado] ?? 'active',
    installments,
    createdAt: new Date(row.creado_en),
  };
}

/** Se lanza cuando `registrar_cobro` no encuentra una cuota `pendiente` (ya pagada o
 * inexistente) — la guarda de concurrencia de contracts/data-contract.md (FR-013 en
 * specs/001-mobile-field-app/, reutilizada tal cual por specs/002-admin-web/ FR-012). */
export class InstallmentAlreadyPaidError extends Error {
  constructor(installmentId: string) {
    super(`La cuota ${installmentId} ya no está pendiente (pagada por otra sesión, o no existe).`);
    this.name = 'InstallmentAlreadyPaidError';
  }
}

/** Implementación concreta de ILoanRepository contra Supabase (contracts/data-contract.md).
 * Compartida por apps/mobile y apps/web — recibe el `SupabaseClient` ya creado (con las
 * credenciales de cada app) por inyección de constructor en vez de un singleton de módulo. */
export class SupabaseLoanRepository implements ILoanRepository {
  private readonly supabase: SupabaseClient;

  // Asignación explícita — ver el mismo comentario en SupabaseClientRepository.ts.
  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  async findById(id: string): Promise<Loan | null> {
    const { data, error } = await this.supabase
      .from('prestamos')
      .select(PRESTAMO_CON_CUOTAS_SELECT)
      .eq('id', id)
      .maybeSingle<PrestamoRow>();

    if (error) throw error;
    return data ? toLoan(data) : null;
  }

  async save(loan: NewLoan): Promise<Loan> {
    const { data: newLoanId, error } = await this.supabase.rpc('emitir_prestamo', {
      p_cliente_id: loan.clientId,
      p_capital: loan.principal,
      p_tasa_interes: loan.interestRate,
      p_estrategia: STRATEGY_TO_DB[loan.strategy],
      p_num_cuotas: loan.installmentCount,
      p_frecuencia: FREQUENCY_TO_DB[loan.frequency],
      p_fecha_emision: toDateOnly(loan.issueDate),
      p_cuotas: loan.installments.map((installment) => ({
        numero: installment.number,
        fecha_vencimiento: toDateOnly(installment.dueDate),
        monto_capital: installment.principalPortion,
        monto_interes: installment.interestPortion,
        monto_cuota: installment.totalAmount,
      })),
    });

    if (error) throw error;

    const created = await this.findById(newLoanId as string);
    if (!created) throw new Error('El préstamo se creó pero no se pudo releer (emitir_prestamo).');
    return created;
  }

  async listByClient(clientId: string): Promise<Loan[]> {
    const { data, error } = await this.supabase
      .from('prestamos')
      .select(PRESTAMO_CON_CUOTAS_SELECT)
      .eq('cliente_id', clientId)
      .order('fecha_emision', { ascending: false })
      .returns<PrestamoRow[]>();

    if (error) throw error;
    return (data ?? []).map(toLoan);
  }

  async findActiveByClient(clientId: string): Promise<Loan | null> {
    const { data, error } = await this.supabase
      .from('prestamos')
      .select(PRESTAMO_CON_CUOTAS_SELECT)
      .eq('cliente_id', clientId)
      .eq('estado', 'activo')
      .maybeSingle<PrestamoRow>();

    if (error) throw error;
    return data ? toLoan(data) : null;
  }

  async markInstallmentPaid(installmentId: string): Promise<LoanInstallment> {
    const { data, error } = await this.supabase
      .rpc('registrar_cobro', { p_cuota_id: installmentId })
      .single<CuotaRow>();

    if (error) {
      if (error.code === 'P0001') throw new InstallmentAlreadyPaidError(installmentId);
      throw error;
    }
    return toLoanInstallment(data);
  }

  async listCollectionRoute(referenceDate: Date): Promise<CollectionRouteEntry[]> {
    const today = toDateOnly(referenceDate);

    const { data, error } = await this.supabase
      .from('cuotas')
      .select(
        'id, numero, fecha_vencimiento, monto_capital, monto_interes, monto_cuota, estado, fecha_pago, monto_pagado, ' +
          'prestamos!inner(id, estado, num_cuotas, clientes!inner(id, nombre, telefono))'
      )
      .eq('estado', 'pendiente')
      .eq('prestamos.estado', 'activo')
      .lte('fecha_vencimiento', today)
      .order('fecha_vencimiento', { ascending: true })
      .returns<
        (CuotaRow & {
          prestamos: { id: string; estado: string; num_cuotas: number; clientes: { id: string; nombre: string; telefono: string } };
        })[]
      >();

    if (error) throw error;

    return (data ?? []).map((row) => {
      const dueDate = fromDateOnly(row.fecha_vencimiento);
      const overdueDays = Math.max(
        0,
        Math.round((referenceDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
      );
      return {
        installment: toLoanInstallment(row),
        loanId: row.prestamos.id,
        installmentCount: row.prestamos.num_cuotas,
        client: { id: row.prestamos.clientes.id, name: row.prestamos.clientes.nombre, phone: row.prestamos.clientes.telefono },
        overdueDays,
      };
    });
  }

  /** Todos los préstamos activos, de cualquier cliente, pre-unidos con su cliente para
   * evitar N+1 (specs/002-admin-web/, US2, contracts/data-contract.md §US2). */
  async listActive(): Promise<ActiveLoanSummary[]> {
    const { data, error } = await this.supabase
      .from('prestamos')
      .select(PRESTAMO_ACTIVO_CON_CLIENTE_SELECT)
      .eq('estado', 'activo')
      .order('fecha_emision', { ascending: false })
      .returns<PrestamoActivoConClienteRow[]>();

    if (error) throw error;

    return (data ?? []).map((row) => ({
      loan: toLoan(row),
      client: { id: row.clientes.id, name: row.clientes.nombre, phone: row.clientes.telefono },
    }));
  }
}
