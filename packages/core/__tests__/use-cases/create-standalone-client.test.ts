import { createStandaloneClient, DuplicatePhoneError } from '../../src/use-cases/createStandaloneClient';
import type { Client, NewClient } from '../../src/interfaces';

/** Fakes en memoria — mismo criterio que issue-loan.test.ts. */
class FakeClientReader {
  constructor(private readonly clients: Client[]) {}
  async findByPhone(phone: string) {
    return this.clients.find((c) => c.phone === phone) ?? null;
  }
}

class FakeClientWriter {
  public created: NewClient[] = [];
  async create(data: NewClient): Promise<Client> {
    this.created.push(data);
    return { id: `new-${this.created.length}`, name: data.name, phone: data.phone, address: data.address, createdAt: new Date() };
  }
}

describe('createStandaloneClient — specs/006-rebrand-currency-polish/ (US3)', () => {
  it('crea el cliente cuando el teléfono no está en uso', async () => {
    const reader = new FakeClientReader([]);
    const writer = new FakeClientWriter();

    const client = await createStandaloneClient(
      { name: 'Ana Torres', phone: '3001234567' },
      { clientReader: reader, clientWriter: writer }
    );

    expect(client.id).toBe('new-1');
    expect(writer.created).toHaveLength(1);
  });

  it('rechaza con DuplicatePhoneError si el teléfono ya pertenece a otro cliente, sin llamar a create', async () => {
    const existing: Client = { id: 'client-1', name: 'Rosa Delgado', phone: '3001234567', createdAt: new Date() };
    const reader = new FakeClientReader([existing]);
    const writer = new FakeClientWriter();

    await expect(
      createStandaloneClient({ name: 'Otro Nombre', phone: '3001234567' }, { clientReader: reader, clientWriter: writer })
    ).rejects.toThrow(DuplicatePhoneError);

    expect(writer.created).toHaveLength(0);
  });
});
