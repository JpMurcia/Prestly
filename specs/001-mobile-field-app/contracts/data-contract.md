# Contract: Datos (Supabase / PostgREST)

Contrato entre la implementación concreta de `ILoanRepository`/`IClientReader`/`IClientWriter` (en `apps/mobile/src/data/`) y la base de datos. El esquema completo (DDL) está fijado en `spec.md` raíz §4 y **no se repite aquí** — este documento solo lista, por historia de usuario, qué operación de Supabase respalda cada método de la interfaz.

## US1 — Cotizar y emitir

**Cotizar**: ninguna llamada a Supabase — `AmortizationCalculator.calculate` es puro (ver `core-interfaces.md`).

**Emitir** (`ILoanRepository.save`, cliente nuevo o existente):

1. Si el cliente es nuevo: `insert` en `clientes` (`nombre`, `telefono`); si ya existe (búsqueda previa por `telefono`, ver `data-model.md`), se reutiliza su `id`.
2. `insert` en `prestamos` (`cliente_id`, `capital`, `tasa_interes`, `num_cuotas`, `frecuencia`, `fecha_emision`, `estado='activo'`).
3. `insert` masivo en `cuotas` (N filas, una por cuota de la tabla ya calculada localmente) referenciando el `prestamo_id` recién creado.

Los pasos 2–3 se ejecutan como una única transacción (Postgres `BEGIN`/`COMMIT` vía una función RPC de Supabase, o una function edge) — si falla la inserción de cuotas, el préstamo tampoco debe quedar creado (evita el edge case "pérdida de conexión durante... una emisión").

## US2 — Cobrar en la ruta de cobranza diaria

**Leer la ruta del día**: `select` sobre `cuotas` con `join` a `prestamos`/`clientes`, filtro `estado='pendiente' AND fecha_vencimiento <= hoy AND prestamos.estado='activo'`, orden por `fecha_vencimiento ASC` — la misma consulta de `data-model.md` §"Ruta de cobranza".

**Registrar un cobro**: función `registrar_cobro(p_cuota_id)` (RPC) hace el `update` de `cuotas` (`estado='pagado'`, `fecha_pago=now()`, `monto_pagado=monto_cuota`) filtrando por `id` y `estado='pendiente'` dentro de una transacción, y lanza una excepción si 0 filas coinciden — guarda de concurrencia: si ya estaba pagada, la app lo trata como conflicto explícito, no como éxito silencioso. El método de pago (efectivo/transferencia) se captura en la UI pero **no se persiste**: el esquema de `cuotas` (spec.md raíz §4) no tiene una columna para eso — ver Assumptions de spec.md.

## US3 — Directorio y cartera

**Listar clientes con filtro**: `select` sobre `clientes` con agregados de `prestamos`/`cuotas` para saldo/progreso (o una vista de aplicación equivalente a `cliente_score` pero orientada a cartera); `ilike` sobre `nombre`/`telefono` para la búsqueda de FR-005; el filtro de estado (`cobro_hoy`/`al_dia`/`mora`) se traduce a condiciones sobre la fecha de la próxima cuota pendiente de cada cliente.

## US4 — Perfil 360°

**Score y fracción**: `select * from cliente_score where cliente_id = :id` (la `VIEW` de `spec.md` raíz §4, sin cambios).

**Historial de préstamos**: `ILoanRepository.listByClient` → `select` sobre `prestamos` por `cliente_id`, con sus `cuotas` agregadas para calcular progreso/atrasos de cada uno.

**Notas privadas**: `IClientWriter.update` → `update clientes set notas_privadas = :texto, notas_actualizadas_en = now() where id = :id`.

## Manejo de FR-013 (offline)

Antes de cualquier `insert`/`update` de esta lista, la app consulta el estado de red (`netinfo`, ver `research.md` §4). Si no hay conexión, la operación ni se intenta: se muestra el aviso de inmediato. Si la conexión se pierde a mitad de una petición ya enviada, la app no marca la cuota/préstamo como confirmado hasta recibir la respuesta del servidor — un reintento del usuario no debe duplicar la fila (ver guarda de concurrencia arriba para cobros; para emisión, la transacción del paso "US1 — Emitir" es atómica por diseño).
