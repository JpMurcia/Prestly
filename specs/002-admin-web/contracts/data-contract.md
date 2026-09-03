# Contract: Datos (Supabase / PostgREST) — Admin Web

Contrato entre la implementación concreta de `ILoanRepository`/`IClientReader`/`IPortfolioReader` (en el nuevo `packages/data-supabase`, compartido con `apps/mobile`) y la base de datos. El esquema completo (DDL) sigue fijado en `spec.md` raíz §4 y no se repite aquí; este documento lista, por historia de usuario, qué operación de Supabase respalda cada método nuevo o reutilizado.

## US1 — Dashboard

**Leer el resumen de cartera** (`IPortfolioReader.getSummary`): `select * from cartera_resumen` (vista de fila única, `data-model.md`) — sin filtros, sin paginación.

## US2 — Préstamos activos y registrar cobro

**Listar préstamos activos** (`ILoanRepository.listActive`, NUEVO): `select` sobre `prestamos` con `estado = 'activo'`, `join` a `cuotas(*)` y a `clientes(id, nombre, telefono)` — mismo patrón de `join` que `listCollectionRoute` de spec 001, para no hacer una petición por préstamo.

**Abrir la tabla de amortización de un préstamo** (`ILoanRepository.findById`): idéntico al ya usado por la app móvil (`LoanDetailScreen`, spec 001, T054) — sin cambios.

**Registrar un cobro** (`ILoanRepository.markInstallmentPaid` → RPC `registrar_cobro`): **exactamente el mismo** procedimiento almacenado que ya usa la app móvil (`supabase/migrations/0002_procedures.sql`), sin ningún cambio. La guarda de concurrencia (`UPDATE ... WHERE estado = 'pendiente'`, con excepción si 0 filas coinciden) ya es atómica a nivel de base de datos — por eso dos intentos simultáneos desde web y móvil sobre la misma cuota (edge case de `spec.md` de esta feature, FR-012/SC-006) resuelven correctamente sin ningún cambio de backend: el segundo `UPDATE` en llegar simplemente no encuentra la fila en estado `pendiente` y Postgres lanza la excepción `P0001`, que la capa de datos traduce a `InstallmentAlreadyPaidError` (igual que en móvil).

## US3 — Directorio/CRM con panel de detalle

**Listar clientes con filtro** (`IClientReader.list`): idéntico a spec 001 US3 — sin cambios.

**Panel de detalle de un cliente** (drawer, mockup 2e): `IClientReader.findById` + `IClientReader.getScore` + `ILoanRepository.listByClient` (para la mini-tabla de amortización del préstamo más reciente) — misma combinación que ya usa `ClientProfileScreen` en spec 001 (US4), sin métodos nuevos.

**Registrar un cobro desde el drawer**: mismo `markInstallmentPaid` de la sección US2 — un solo camino de escritura para cuotas, sin importar desde qué pantalla se invoque.

## US4 — Cotizar y emitir desde escritorio

**Cotizar**: ninguna llamada a Supabase — `AmortizationCalculator.calculate` es puro (idéntico a spec 001 US1).

**Emitir**: mismo flujo y misma función RPC `emitir_prestamo` que ya usa la app móvil (spec 001, `contracts/data-contract.md` §US1) — inserción de cliente (si es nuevo, con la misma guarda anti-duplicado por teléfono) + préstamo + cuotas en una sola transacción. Sin cambios de backend.

## Exportar CSV (FR-007, todas las historias con tabla)

No es una operación de Supabase — se serializa en el cliente a partir de los datos ya cargados en memoria (`ActiveLoanSummary[]`/`Client[]` de las consultas de arriba), ver `research.md` §5. No dispara ninguna petición adicional.

## Migración nueva requerida

`supabase/migrations/0003_cartera_resumen.sql` (ver `data-model.md`) — la única adición de esquema de esta feature. Todo lo demás (tablas, tipos, `emitir_prestamo`, `registrar_cobro`) se reutiliza de `0001_initial_schema.sql`/`0002_procedures.sql` sin cambios.
