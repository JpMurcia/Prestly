import type { AppSettings, CurrencyCode, IAppSettingsRepository } from '@repo/core';
import type { SupabaseClient } from '@supabase/supabase-js';

interface ConfiguracionAppRow {
  moneda: CurrencyCode;
}

/** Implementación concreta de IAppSettingsRepository contra la tabla singleton
 * `configuracion_app` (data-contract.md) — acceso directo por supabase-js, sin RPC ni Vault:
 * la moneda no es un secreto, mismo nivel de acceso que clientes/prestamos/cuotas. Compartida
 * por apps/mobile (solo lectura) y apps/web (lectura + escritura), igual patrón de inyección de
 * constructor que el resto de repositorios de este paquete. */
export class SupabaseAppSettingsRepository implements IAppSettingsRepository {
  private readonly supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  async getSettings(): Promise<AppSettings> {
    const { data, error } = await this.supabase
      .from('configuracion_app')
      .select('moneda')
      .eq('id', 1)
      .single<ConfiguracionAppRow>();

    if (error) throw error;
    return { currency: data.moneda };
  }

  async updateCurrency(currency: CurrencyCode): Promise<AppSettings> {
    const { data, error } = await this.supabase
      .from('configuracion_app')
      .update({ moneda: currency, actualizado_en: new Date().toISOString() })
      .eq('id', 1)
      .select('moneda')
      .single<ConfiguracionAppRow>();

    if (error) throw error;
    return { currency: data.moneda };
  }
}
