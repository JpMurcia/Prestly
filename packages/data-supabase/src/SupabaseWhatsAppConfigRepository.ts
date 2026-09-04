import type { IWhatsAppConfigRepository, WhatsAppConfigStatus } from '@repo/core';
import type { SupabaseClient } from '@supabase/supabase-js';

/** Credenciales incompletas al intentar guardar la conexión (`P0004`,
 * supabase/migrations/0005_whatsapp_automation.sql) — normalmente ya evitado por validación
 * en el formulario, pero la API no confía únicamente en eso. */
export class IncompleteWhatsAppCredentialsError extends Error {
  constructor() {
    super('Faltan datos para guardar la conexión con WhatsApp (Account SID, Auth Token o número de envío).');
    this.name = 'IncompleteWhatsAppCredentialsError';
  }
}

interface EstadoConfiguracionRow {
  conectado: boolean;
  numero_desde: string | null;
}

/** Implementación concreta de IWhatsAppConfigRepository — puente hacia las funciones
 * `SECURITY DEFINER` que leen/escriben Supabase Vault (specs/004-whatsapp-automation/,
 * Historia 2, data-contract.md). Nunca lee `vault.*` directamente: el rol `anon` no tiene
 * grants ahí a propósito. */
export class SupabaseWhatsAppConfigRepository implements IWhatsAppConfigRepository {
  private readonly supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  async getStatus(): Promise<WhatsAppConfigStatus> {
    const { data, error } = await this.supabase
      .rpc('estado_configuracion_whatsapp')
      .single<EstadoConfiguracionRow>();

    if (error) throw error;
    return { connected: data.conectado, fromNumber: data.numero_desde };
  }

  async saveCredentials(accountSid: string, authToken: string, fromNumber: string): Promise<void> {
    const { error } = await this.supabase.rpc('guardar_configuracion_whatsapp', {
      p_account_sid: accountSid,
      p_auth_token: authToken,
      p_numero_desde: fromNumber,
    });

    if (error) {
      if (error.code === 'P0004') throw new IncompleteWhatsAppCredentialsError();
      throw error;
    }
  }

  async clearCredentials(): Promise<void> {
    const { error } = await this.supabase.rpc('borrar_configuracion_whatsapp');
    if (error) throw error;
  }
}
