import type { Client, IClientReader, IClientWriter, NewClient } from '../interfaces';

export class DuplicatePhoneError extends Error {
  constructor(phone: string) {
    super(`Ya existe un cliente con el teléfono ${phone}.`);
    this.name = 'DuplicatePhoneError';
  }
}

export interface CreateStandaloneClientDeps {
  clientReader: Pick<IClientReader, 'findByPhone'>;
  clientWriter: Pick<IClientWriter, 'create'>;
}

/**
 * Crea un cliente sin ningún préstamo asociado (spec FR-006, US3). A diferencia de
 * resolveClientId (interno de issueLoan.ts), que reutiliza en silencio un cliente existente con
 * el mismo teléfono, esta función RECHAZA la creación lanzando DuplicatePhoneError si ya existe
 * uno — semántica de alta explícita (spec FR-007), no de "encontrar o crear"
 * (research.md §3).
 */
export async function createStandaloneClient(
  input: NewClient,
  deps: CreateStandaloneClientDeps
): Promise<Client> {
  const existing = await deps.clientReader.findByPhone(input.phone);
  if (existing) throw new DuplicatePhoneError(input.phone);

  return deps.clientWriter.create(input);
}
