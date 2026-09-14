import type { AppSettings, CurrencyCode, IAppSettingsRepository, PrincipalContributionMode } from '@repo/core';
import type { SupabaseClient } from '@supabase/supabase-js';

type ModoAbonoCapitalDb = 'reducir_plazo' | 'reducir_cuota';

interface ConfiguracionAppRow {
  moneda: CurrencyCode;
  modo_abono_capital: ModoAbonoCapitalDb;
}

const MODE_FROM_DB: Record<ModoAbonoCapitalDb, PrincipalContributionMode> = {
  reducir_plazo: 'reduce_term',
  reducir_cuota: 'reduce_installment',
};
const MODE_TO_DB: Record<PrincipalContributionMode, ModoAbonoCapitalDb> = {
  reduce_term: 'reducir_plazo',
  reduce_installment: 'reducir_cuota',
};

function toAppSettings(row: ConfiguracionAppRow): AppSettings {
  return { currency: row.moneda, principalContributionMode: MODE_FROM_DB[row.modo_abono_capital] };
}

/** Implementación concreta de IAppSettingsRepository contra la tabla singleton
 * `configuracion_app` (data-contract.md) — acceso directo por supabase-js, sin RPC ni Vault:
 * ni la moneda ni el modo de abono a capital son secretos, mismo nivel de acceso que
 * clientes/prestamos/cuotas. Compartida por apps/mobile (solo lectura) y apps/web (lectura +
 * escritura), igual patrón de inyección de constructor que el resto de repositorios de este
 * paquete. */
export class SupabaseAppSettingsRepository implements IAppSettingsRepository {
  private readonly supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  async getSettings(): Promise<AppSettings> {
    const { data, error } = await this.supabase
      .from('configuracion_app')
      .select('moneda, modo_abono_capital')
      .eq('id', 1)
      .single<ConfiguracionAppRow>();

    if (error) throw error;
    return toAppSettings(data);
  }

  async updateCurrency(currency: CurrencyCode): Promise<AppSettings> {
    const { data, error } = await this.supabase
      .from('configuracion_app')
      .update({ moneda: currency, actualizado_en: new Date().toISOString() })
      .eq('id', 1)
      .select('moneda, modo_abono_capital')
      .single<ConfiguracionAppRow>();

    if (error) throw error;
    return toAppSettings(data);
  }

  /** specs/008-flexible-repayment-features/, US2 (research.md D6) — config única de
   * instalación, mismo patrón que updateCurrency. */
  async updatePrincipalContributionMode(mode: PrincipalContributionMode): Promise<AppSettings> {
    const { data, error } = await this.supabase
      .from('configuracion_app')
      .update({ modo_abono_capital: MODE_TO_DB[mode], actualizado_en: new Date().toISOString() })
      .eq('id', 1)
      .select('moneda, modo_abono_capital')
      .single<ConfiguracionAppRow>();

    if (error) throw error;
    return toAppSettings(data);
  }
}
