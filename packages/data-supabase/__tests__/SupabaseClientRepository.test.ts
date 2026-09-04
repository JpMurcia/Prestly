import { SupabaseClientRepository } from '../src/SupabaseClientRepository';
import { fakeSupabase } from './testHelpers';

describe('SupabaseClientRepository', () => {
  it('mapea una fila de clientes (con préstamo activo embebido) a Client con su portfolio derivado', async () => {
    const row = {
      id: 'c1',
      nombre: 'Rosa Delgado',
      telefono: '+1 809 555 0142',
      direccion: null,
      notas_privadas: null,
      notas_actualizadas_en: null,
      creado_en: '2026-01-01T00:00:00.000Z',
      prestamos: [
        {
          id: 'p1',
          capital: 500,
          num_cuotas: 12,
          cuotas: [
            { id: 'cu1', estado: 'pagado', fecha_vencimiento: '2020-01-01', monto_cuota: 47.92, monto_pagado: 47.92 },
            { id: 'cu2', estado: 'pendiente', fecha_vencimiento: '2099-01-01', monto_cuota: 47.92, monto_pagado: null },
          ],
        },
      ],
    };
    const supabase = fakeSupabase({ data: row, error: null });
    const repo = new SupabaseClientRepository(supabase as never);

    const client = await repo.findById('c1');

    expect(client?.name).toBe('Rosa Delgado');
    expect(client?.portfolio?.status).toBe('al_dia');
    expect(client?.portfolio?.principalLent).toBe(500);
    expect(client?.portfolio?.installmentsPaid).toBe(1);
  });

  it('list() añade el filtro `or` de búsqueda cuando se pasa un término', async () => {
    const supabase = fakeSupabase({ data: [], error: null });
    const repo = new SupabaseClientRepository(supabase as never);

    const orSpy = jest.fn();
    // A diferencia de chainableResult() (usado en los demás tests), aquí las funciones se
    // declaran dentro del propio objeto para que TODOS los métodos de la cadena —sin
    // importar el orden en que el código bajo prueba las llame— devuelvan esta misma
    // instancia (necesario para que `or` intercepte la llamada real de list()).
    const handler = {
      select: () => handler,
      eq: () => handler,
      order: () => handler,
      or: (...args: unknown[]) => {
        orSpy(...args);
        return handler;
      },
      returns: () => Promise.resolve({ data: [], error: null }),
    };
    supabase.from.mockReturnValueOnce(handler as never);

    await repo.list({ search: 'rosa' });

    expect(orSpy).toHaveBeenCalledWith(expect.stringContaining('rosa'));
  });

  it('descuenta del saldo lo ya cobrado de una cuota `parcial`, no solo de las `pagado` (specs/003-operational-management, corrección de computePortfolio)', async () => {
    const row = {
      id: 'c1',
      nombre: 'Rosa Delgado',
      telefono: '+1 809 555 0142',
      direccion: null,
      notas_privadas: null,
      notas_actualizadas_en: null,
      creado_en: '2026-01-01T00:00:00.000Z',
      prestamos: [
        {
          id: 'p1',
          capital: 500,
          num_cuotas: 2,
          cuotas: [
            { id: 'cu1', estado: 'parcial', fecha_vencimiento: '2099-01-01', monto_cuota: 47.92, monto_pagado: 20 },
            { id: 'cu2', estado: 'pendiente', fecha_vencimiento: '2099-01-08', monto_cuota: 47.92, monto_pagado: null },
          ],
        },
      ],
    };
    const supabase = fakeSupabase({ data: row, error: null });
    const repo = new SupabaseClientRepository(supabase as never);

    const client = await repo.findById('c1');

    // Saldo total de las 2 cuotas ($95.84) menos lo ya cobrado en la parcial ($20) = $75.84 —
    // no $95.84 (que ignoraría el abono parcial) ni $47.92 (que la trataría como pagada).
    expect(client?.portfolio?.balance).toBeCloseTo(75.84, 2);
  });

  it('propaga el error de Supabase en vez de tragárselo', async () => {
    const supabase = fakeSupabase({ data: null, error: { message: 'boom' } });
    const repo = new SupabaseClientRepository(supabase as never);

    await expect(repo.findById('c1')).rejects.toEqual({ message: 'boom' });
  });
});
