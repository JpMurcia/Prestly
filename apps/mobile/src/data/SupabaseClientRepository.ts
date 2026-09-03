import type {
  Client,
  ClientFilter,
  ClientPortfolioSummary,
  ClientScore,
  IClientReader,
  IClientWriter,
  NewClient,
  PortfolioStatus,
} from '@repo/core';
import { supabase } from './supabaseClient';

/** Fila cruda de `clientes`, con sus `prestamos` (filtrados a `estado='activo'`) embebidos vía PostgREST. */
interface ClienteRow {
  id: string;
  nombre: string;
  telefono: string;
  direccion: string | null;
  notas_privadas: string | null;
  notas_actualizadas_en: string | null;
  creado_en: string;
  prestamos: PrestamoActivoRow[] | null;
}

interface PrestamoActivoRow {
  id: string;
  capital: number;
  num_cuotas: number;
  cuotas: CuotaRow[] | null;
}

interface CuotaRow {
  id: string;
  estado: 'pendiente' | 'pagado';
  fecha_vencimiento: string;
  monto_cuota: number;
  monto_pagado: number | null;
}

const CLIENTE_CON_PRESTAMO_ACTIVO_SELECT =
  'id, nombre, telefono, direccion, notas_privadas, notas_actualizadas_en, creado_en, ' +
  'prestamos(id, capital, num_cuotas, cuotas(id, estado, fecha_vencimiento, monto_cuota, monto_pagado))';

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function computePortfolio(prestamo: PrestamoActivoRow | undefined, today: Date): ClientPortfolioSummary | undefined {
  if (!prestamo) {
    return { status: 'sin_prestamo_activo', balance: 0, principalLent: 0, installmentsPaid: 0, installmentsTotal: 0 };
  }

  const cuotas = prestamo.cuotas ?? [];
  const installmentsPaid = cuotas.filter((c) => c.estado === 'pagado').length;
  const balance = cuotas.reduce((acc, c) => {
    const pagado = c.estado === 'pagado' ? (c.monto_pagado ?? c.monto_cuota) : 0;
    return acc + (c.monto_cuota - pagado);
  }, 0);

  const pendientes = cuotas
    .filter((c) => c.estado === 'pendiente')
    .sort((a, b) => a.fecha_vencimiento.localeCompare(b.fecha_vencimiento));
  const proxima = pendientes[0];

  let status: PortfolioStatus = 'al_dia';
  let overdueDays: number | undefined;
  let nextDueDate: Date | undefined;

  if (proxima) {
    nextDueDate = new Date(proxima.fecha_vencimiento);
    const diffDays = Math.round((today.getTime() - nextDueDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > 0) {
      status = 'mora';
      overdueDays = diffDays;
    } else if (diffDays === 0) {
      status = 'cobro_hoy';
    } else {
      status = 'al_dia';
    }
  }

  return {
    status,
    balance: Math.round(balance * 100) / 100,
    principalLent: prestamo.capital,
    installmentsPaid,
    installmentsTotal: prestamo.num_cuotas,
    overdueDays,
    nextDueDate,
    nextInstallmentId: proxima?.id,
    nextInstallmentAmount: proxima?.monto_cuota,
  };
}

function toClient(row: ClienteRow, today: Date): Client {
  const prestamoActivo = row.prestamos?.[0];
  return {
    id: row.id,
    name: row.nombre,
    phone: row.telefono,
    address: row.direccion ?? undefined,
    privateNotes: row.notas_privadas ?? undefined,
    notesUpdatedAt: row.notas_actualizadas_en ? new Date(row.notas_actualizadas_en) : undefined,
    createdAt: new Date(row.creado_en),
    portfolio: computePortfolio(prestamoActivo, today),
  };
}

/** Implementación concreta de IClientReader/IClientWriter contra Supabase (contracts/data-contract.md §US3/§US4). */
export class SupabaseClientRepository implements IClientReader, IClientWriter {
  async findById(id: string): Promise<Client | null> {
    const { data, error } = await supabase
      .from('clientes')
      .select(CLIENTE_CON_PRESTAMO_ACTIVO_SELECT)
      .eq('id', id)
      .eq('prestamos.estado', 'activo')
      .maybeSingle<ClienteRow>();

    if (error) throw error;
    if (!data) return null;
    return toClient(data, startOfToday());
  }

  async list(filter?: ClientFilter): Promise<Client[]> {
    let query = supabase
      .from('clientes')
      .select(CLIENTE_CON_PRESTAMO_ACTIVO_SELECT)
      .eq('prestamos.estado', 'activo')
      .order('nombre', { ascending: true });

    if (filter?.search) {
      const term = filter.search.trim();
      query = query.or(`nombre.ilike.%${term}%,telefono.ilike.%${term}%`);
    }

    const { data, error } = await query.returns<ClienteRow[]>();
    if (error) throw error;

    const today = startOfToday();
    const clients = (data ?? []).map((row) => toClient(row, today));

    if (!filter?.status || filter.status === 'todos') return clients;
    return clients.filter((client) => client.portfolio?.status === filter.status);
  }

  async create(data: NewClient): Promise<Client> {
    const { data: row, error } = await supabase
      .from('clientes')
      .insert({ nombre: data.name, telefono: data.phone, direccion: data.address ?? null })
      .select('id, nombre, telefono, direccion, notas_privadas, notas_actualizadas_en, creado_en')
      .single();

    if (error) throw error;
    return toClient({ ...row, prestamos: [] }, startOfToday());
  }

  async update(id: string, data: Partial<Client>): Promise<Client> {
    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch.nombre = data.name;
    if (data.phone !== undefined) patch.telefono = data.phone;
    if (data.address !== undefined) patch.direccion = data.address;
    if (data.privateNotes !== undefined) {
      patch.notas_privadas = data.privateNotes;
      patch.notas_actualizadas_en = new Date().toISOString();
    }

    const { data: row, error } = await supabase
      .from('clientes')
      .update(patch)
      .eq('id', id)
      .select(CLIENTE_CON_PRESTAMO_ACTIVO_SELECT)
      .eq('prestamos.estado', 'activo')
      .single<ClienteRow>();

    if (error) throw error;
    return toClient(row, startOfToday());
  }

  async getScore(clientId: string): Promise<ClientScore> {
    const { data, error } = await supabase
      .from('cliente_score')
      .select('grado, cuotas_pagadas, cuotas_historicas')
      .eq('cliente_id', clientId)
      .maybeSingle<{ grado: string | null; cuotas_pagadas: number; cuotas_historicas: number }>();

    if (error) throw error;
    if (!data) return { grade: null, installmentsPaidOnTime: 0, installmentsHistorical: 0 };

    return {
      grade: (data.grado as ClientScore['grade']) ?? null,
      installmentsPaidOnTime: data.cuotas_pagadas,
      installmentsHistorical: data.cuotas_historicas,
    };
  }

  /** Búsqueda por teléfono exacto para la guarda anti-duplicado de US1 (data-model.md). */
  async findByPhone(phone: string): Promise<Client | null> {
    const { data, error } = await supabase
      .from('clientes')
      .select(CLIENTE_CON_PRESTAMO_ACTIVO_SELECT)
      .eq('telefono', phone)
      .eq('prestamos.estado', 'activo')
      .maybeSingle<ClienteRow>();

    if (error) throw error;
    if (!data) return null;
    return toClient(data, startOfToday());
  }
}
