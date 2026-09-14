import { SupabaseAppSettingsRepository } from '../src/SupabaseAppSettingsRepository';
import { chainableResult } from './testHelpers';

describe('SupabaseAppSettingsRepository — specs/006-rebrand-currency-polish/, US1', () => {
  it('getSettings mapea la fila singleton de configuracion_app', async () => {
    const fromSpy = jest
      .fn()
      .mockReturnValue(chainableResult({ data: { moneda: 'COP', modo_abono_capital: 'reducir_plazo' }, error: null }));
    const supabase = { from: fromSpy, rpc: jest.fn() };
    const repo = new SupabaseAppSettingsRepository(supabase as never);

    const settings = await repo.getSettings();

    expect(fromSpy).toHaveBeenCalledWith('configuracion_app');
    expect(settings).toEqual({ currency: 'COP', principalContributionMode: 'reduce_term' });
  });

  it('updateCurrency actualiza la fila y devuelve la moneda ya guardada', async () => {
    const fromSpy = jest
      .fn()
      .mockReturnValue(chainableResult({ data: { moneda: 'USD', modo_abono_capital: 'reducir_plazo' }, error: null }));
    const supabase = { from: fromSpy, rpc: jest.fn() };
    const repo = new SupabaseAppSettingsRepository(supabase as never);

    const settings = await repo.updateCurrency('USD');

    expect(fromSpy).toHaveBeenCalledWith('configuracion_app');
    expect(settings).toEqual({ currency: 'USD', principalContributionMode: 'reduce_term' });
  });

  it('propaga el error de Supabase si la fila no existe o el update falla', async () => {
    const supabase = { from: jest.fn().mockReturnValue(chainableResult({ data: null, error: { message: 'row not found' } })), rpc: jest.fn() };
    const repo = new SupabaseAppSettingsRepository(supabase as never);

    await expect(repo.getSettings()).rejects.toEqual({ message: 'row not found' });
  });
});

describe('SupabaseAppSettingsRepository — specs/008-flexible-repayment-features/, US2', () => {
  it('updatePrincipalContributionMode traduce reduce_installment a reducir_cuota y devuelve el mapeo inverso', async () => {
    const fromSpy = jest
      .fn()
      .mockReturnValue(chainableResult({ data: { moneda: 'COP', modo_abono_capital: 'reducir_cuota' }, error: null }));
    const supabase = { from: fromSpy, rpc: jest.fn() };
    const repo = new SupabaseAppSettingsRepository(supabase as never);

    const settings = await repo.updatePrincipalContributionMode('reduce_installment');

    expect(fromSpy).toHaveBeenCalledWith('configuracion_app');
    expect(settings).toEqual({ currency: 'COP', principalContributionMode: 'reduce_installment' });
  });
});
