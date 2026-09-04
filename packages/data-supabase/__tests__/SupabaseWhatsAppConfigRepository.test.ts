import { IncompleteWhatsAppCredentialsError, SupabaseWhatsAppConfigRepository } from '../src/SupabaseWhatsAppConfigRepository';
import { chainableResult } from './testHelpers';

describe('SupabaseWhatsAppConfigRepository — specs/004-whatsapp-automation, Historia 2', () => {
  it('getStatus mapea la fila de estado_configuracion_whatsapp (conectado)', async () => {
    const rpcSpy = jest.fn().mockReturnValue(chainableResult({ data: { conectado: true, numero_desde: 'whatsapp:+14155238886' }, error: null }));
    const supabase = { from: jest.fn(), rpc: rpcSpy };
    const repo = new SupabaseWhatsAppConfigRepository(supabase as never);

    const status = await repo.getStatus();

    expect(rpcSpy).toHaveBeenCalledWith('estado_configuracion_whatsapp');
    expect(status).toEqual({ connected: true, fromNumber: 'whatsapp:+14155238886' });
  });

  it('getStatus mapea "no configurado" sin exponer ningún dato de credencial', async () => {
    const rpcSpy = jest.fn().mockReturnValue(chainableResult({ data: { conectado: false, numero_desde: null }, error: null }));
    const supabase = { from: jest.fn(), rpc: rpcSpy };
    const repo = new SupabaseWhatsAppConfigRepository(supabase as never);

    const status = await repo.getStatus();

    expect(status).toEqual({ connected: false, fromNumber: null });
  });

  it('saveCredentials llama a guardar_configuracion_whatsapp con los 3 parámetros', async () => {
    const rpcSpy = jest.fn().mockReturnValue(chainableResult({ data: null, error: null }));
    const supabase = { from: jest.fn(), rpc: rpcSpy };
    const repo = new SupabaseWhatsAppConfigRepository(supabase as never);

    await repo.saveCredentials('ACxxx', 'token', 'whatsapp:+14155238886');

    expect(rpcSpy).toHaveBeenCalledWith('guardar_configuracion_whatsapp', {
      p_account_sid: 'ACxxx',
      p_auth_token: 'token',
      p_numero_desde: 'whatsapp:+14155238886',
    });
  });

  it('saveCredentials traduce el error P0004 a IncompleteWhatsAppCredentialsError', async () => {
    const rpcSpy = jest.fn().mockReturnValue(chainableResult({ data: null, error: { code: 'P0004', message: 'CREDENCIALES_INCOMPLETAS' } }));
    const supabase = { from: jest.fn(), rpc: rpcSpy };
    const repo = new SupabaseWhatsAppConfigRepository(supabase as never);

    await expect(repo.saveCredentials('', 'token', 'whatsapp:+14155238886')).rejects.toBeInstanceOf(IncompleteWhatsAppCredentialsError);
  });

  it('clearCredentials llama a borrar_configuracion_whatsapp', async () => {
    const rpcSpy = jest.fn().mockReturnValue(chainableResult({ data: null, error: null }));
    const supabase = { from: jest.fn(), rpc: rpcSpy };
    const repo = new SupabaseWhatsAppConfigRepository(supabase as never);

    await repo.clearCredentials();

    expect(rpcSpy).toHaveBeenCalledWith('borrar_configuracion_whatsapp');
  });
});
