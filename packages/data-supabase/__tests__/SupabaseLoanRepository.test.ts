import {
  SupabaseLoanRepository,
  InstallmentAlreadyPaidError,
  InvalidPaymentAmountError,
  LoanNotActiveError,
} from '../src/SupabaseLoanRepository';
import { chainableResult, fakeSupabase } from './testHelpers';

const CUOTA_ROW = {
  id: 'cu1',
  numero: 1,
  fecha_vencimiento: '2026-01-08',
  monto_capital: 41.67,
  monto_interes: 6.25,
  monto_cuota: 47.92,
  estado: 'pendiente' as const,
  fecha_pago: null,
  monto_pagado: null,
};

describe('SupabaseLoanRepository', () => {
  it('findById mapea un préstamo con sus cuotas ordenadas por número', async () => {
    const row = {
      id: 'p1',
      cliente_id: 'c1',
      capital: 500,
      tasa_interes: 0.15,
      estrategia: 'simple_cuota_fija',
      num_cuotas: 12,
      frecuencia: 'semanal',
      fecha_emision: '2026-01-01',
      estado: 'activo',
      creado_en: '2026-01-01T00:00:00.000Z',
      cuotas: [CUOTA_ROW],
    };
    const supabase = fakeSupabase({ data: row, error: null });
    const repo = new SupabaseLoanRepository(supabase as never);

    const loan = await repo.findById('p1');

    expect(loan?.principal).toBe(500);
    expect(loan?.installments).toHaveLength(1);
    expect(loan?.installments[0]?.totalAmount).toBe(47.92);
  });

  it('listActive() pre-une cada préstamo con su cliente en ActiveLoanSummary (specs/002-admin-web, US2)', async () => {
    const rows = [
      {
        id: 'p1',
        cliente_id: 'c1',
        capital: 500,
        tasa_interes: 0.15,
        estrategia: 'simple_cuota_fija',
        num_cuotas: 12,
        frecuencia: 'semanal',
        fecha_emision: '2026-01-01',
        estado: 'activo',
        creado_en: '2026-01-01T00:00:00.000Z',
        cuotas: [CUOTA_ROW],
        clientes: { id: 'c1', nombre: 'Rosa Delgado', telefono: '+1 809 555 0142' },
      },
    ];
    const supabase = fakeSupabase({ data: rows, error: null });
    const repo = new SupabaseLoanRepository(supabase as never);

    const [summary] = await repo.listActive();

    expect(summary?.loan.id).toBe('p1');
    expect(summary?.client).toEqual({ id: 'c1', name: 'Rosa Delgado', phone: '+1 809 555 0142' });
  });

  it('registerInstallmentPayment traduce el error P0001 de `registrar_cobro` a InstallmentAlreadyPaidError (guarda de concurrencia)', async () => {
    const supabase = fakeSupabase({ data: null, error: null });
    supabase.rpc.mockReturnValue(
      chainableResult({ data: null, error: { code: 'P0001', message: 'CUOTA_YA_PAGADA_O_INEXISTENTE' } })
    );
    const repo = new SupabaseLoanRepository(supabase as never);

    await expect(repo.registerInstallmentPayment('cu1', 47.92)).rejects.toBeInstanceOf(InstallmentAlreadyPaidError);
  });

  it('registerInstallmentPayment traduce el error P0002 de `registrar_cobro` a InvalidPaymentAmountError (specs/003, FR-004)', async () => {
    const supabase = fakeSupabase({ data: null, error: null });
    supabase.rpc.mockReturnValue(
      chainableResult({ data: null, error: { code: 'P0002', message: 'MONTO_INVALIDO' } })
    );
    const repo = new SupabaseLoanRepository(supabase as never);

    await expect(repo.registerInstallmentPayment('cu1', 999)).rejects.toBeInstanceOf(InvalidPaymentAmountError);
  });

  it('registerInstallmentPayment envía p_cuota_id y p_monto a la RPC `registrar_cobro`, y mapea una cuota `parcial` a status `partial` (specs/003, US1)', async () => {
    const rpcSpy = jest.fn().mockReturnValue(
      chainableResult({
        data: {
          id: 'cu1',
          numero: 1,
          fecha_vencimiento: '2026-09-10',
          monto_capital: 41.67,
          monto_interes: 6.25,
          monto_cuota: 47.92,
          estado: 'parcial',
          fecha_pago: null,
          monto_pagado: 20,
        },
        error: null,
      })
    );
    const supabase = { from: jest.fn(), rpc: rpcSpy };
    const repo = new SupabaseLoanRepository(supabase as never);

    const installment = await repo.registerInstallmentPayment('cu1', 20);

    expect(rpcSpy).toHaveBeenCalledWith('registrar_cobro', { p_cuota_id: 'cu1', p_monto: 20 });
    expect(installment.status).toBe('partial');
    expect(installment.paidAmount).toBe(20);
    expect(installment.paidAt).toBeUndefined();
  });

  it('payoffLoan llama a la RPC `liquidar_prestamo` y relee el préstamo completo (specs/003, US2)', async () => {
    const loanRow = {
      id: 'p1',
      cliente_id: 'c1',
      capital: 500,
      tasa_interes: 0.15,
      estrategia: 'simple_cuota_fija',
      num_cuotas: 1,
      frecuencia: 'semanal',
      fecha_emision: '2026-01-01',
      estado: 'liquidado',
      creado_en: '2026-01-01T00:00:00.000Z',
      cuotas: [CUOTA_ROW],
    };
    const rpcSpy = jest.fn().mockReturnValue(chainableResult({ data: { id: 'p1' }, error: null }));
    const supabase = { from: jest.fn().mockReturnValue(chainableResult({ data: loanRow, error: null })), rpc: rpcSpy };
    const repo = new SupabaseLoanRepository(supabase as never);

    const loan = await repo.payoffLoan('p1');

    expect(rpcSpy).toHaveBeenCalledWith('liquidar_prestamo', { p_prestamo_id: 'p1' });
    expect(loan.status).toBe('settled');
  });

  it('payoffLoan traduce el error P0003 de `liquidar_prestamo` a LoanNotActiveError', async () => {
    const supabase = fakeSupabase({ data: null, error: null });
    supabase.rpc.mockReturnValue(
      chainableResult({ data: null, error: { code: 'P0003', message: 'PRESTAMO_NO_ACTIVO_O_INEXISTENTE' } })
    );
    const repo = new SupabaseLoanRepository(supabase as never);

    await expect(repo.payoffLoan('p1')).rejects.toBeInstanceOf(LoanNotActiveError);
  });
});
