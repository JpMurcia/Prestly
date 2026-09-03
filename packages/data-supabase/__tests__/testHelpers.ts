/** Mock mínimo y encadenable del query builder de `@supabase/supabase-js`, para no depender
 * de una base de datos real en los tests de mapeo fila↔dominio de este paquete. Cada método
 * de la cadena (`select`, `eq`, `or`, `order`, `insert`, `update`) devuelve el mismo objeto;
 * los métodos terminales (`single`, `maybeSingle`, `returns`, o `await` directo vía `then`)
 * resuelven al resultado configurado. */
export function chainableResult(result: { data: unknown; error: unknown }) {
  const handler: Record<string, (...args: unknown[]) => unknown> = {
    select: () => handler,
    insert: () => handler,
    update: () => handler,
    eq: () => handler,
    or: () => handler,
    lte: () => handler,
    order: () => handler,
    returns: () => handler,
    single: () => Promise.resolve(result),
    maybeSingle: () => Promise.resolve(result),
    // Imprescindible: el query builder real de @supabase/supabase-js también es PromiseLike
    // (se puede `await` sin llamar a .single()/.maybeSingle()), y varios métodos del
    // repositorio bajo prueba dependen de eso.
    // eslint-disable-next-line unicorn/no-thenable
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(resolve(result)),
  };
  return handler;
}

export function fakeSupabase(fromResult: { data: unknown; error: unknown }) {
  return {
    from: jest.fn().mockReturnValue(chainableResult(fromResult)),
    rpc: jest.fn(),
  };
}
