# Contract: Datos (Supabase / PostgREST) — Gestión Operativa Integral

Contrato entre la implementación concreta de `ILoanRepository`/`IPortfolioReader` (`packages/data-supabase`, compartido por `apps/mobile` y `apps/web`) y la base de datos. El DDL completo vive en `data-model.md`; este documento lista, por historia de usuario, qué operación de Supabase respalda cada método nuevo o cambiado.

## US1 — Registrar un pago parcial de una cuota

**Registrar el pago** (`ILoanRepository.registerInstallmentPayment(installmentId, amount)`): `supabase.rpc('registrar_cobro', { p_cuota_id: installmentId, p_monto: amount })` — mismo procedimiento que ya usan ambas apps desde `specs/001-mobile-field-app/`, ahora extendido (`data-model.md`) para aceptar un monto explícito y el estado `parcial`. Si `error.code === 'P0001'` (cuota ya no admite pagos) → `InstallmentAlreadyPaidError` (sin cambios); si `error.code === 'P0002'` (monto inválido — excede el saldo restante) → nuevo `InvalidPaymentAmountError`.

**Mostrar el estado "parcial" en las tablas de amortización** (móvil y web): el mapeo fila→dominio de `packages/data-supabase` traduce `cuotas.estado = 'parcial'` a `InstallmentStatus = 'partial'` — mismo `Record<string, InstallmentStatus>` de traducción que ya existe para `'pendiente'`/`'pagado'`, solo con una entrada más.

## US2 — Liquidar anticipadamente un préstamo

**Monto a cobrar antes de confirmar**: no dispara ninguna petición nueva — se deriva en el hook (`apps/web`/`apps/mobile`) sumando `installment.totalAmount - (installment.paidAmount ?? 0)` sobre las cuotas no `'paid'` del `Loan` ya cargado por `ILoanRepository.findById`.

**Confirmar la liquidación** (`ILoanRepository.payoffLoan(loanId)`): `supabase.rpc('liquidar_prestamo', { p_prestamo_id: loanId })` (NUEVO procedimiento, `data-model.md`) — devuelve el préstamo con `estado = 'liquidado'`; el mapeo fila→dominio reutiliza `toLoan` ya existente sin cambios (releyendo el préstamo completo después, igual patrón que `save()` ya usa tras `emitir_prestamo`). Si `error.code === 'P0003'` (préstamo no activo o inexistente) → nuevo `LoanNotActiveError`.

## US3 — Ver la tendencia de ganancias y capital

**Leer la tendencia** (`IPortfolioReader.getTrend()`, NUEVO): `select * from cartera_tendencia_mensual order by periodo` (vista derivada, `data-model.md`) — sin filtros ni paginación, igual patrón de fila-múltiple-sin-parámetros que `getSummary()` usa para `cartera_resumen` (fila única).

**Estado de "historial limitado"**: se decide en `apps/web` según `trend.length < 2` (menos de 2 meses con datos) — no es una condición de la consulta.

## Regla de concurrencia (FR-007, SC-004) — sin cambios de backend adicionales

La guarda ya existente (`UPDATE ... WHERE estado IN (...)` bajo `FOR UPDATE`, con excepción si la fila no coincide) se extiende dentro del mismo procedimiento (`data-model.md`) — dos cobros (totales o parciales) simultáneos sobre la misma cuota, o una liquidación anticipada corriendo a la vez que un cobro individual sobre una cuota del mismo préstamo, resuelven correctamente porque **ambos caminos pasan por la misma función `registrar_cobro`**, nunca por lógica de concurrencia distinta según la superficie o el tipo de pago.

## Migración nueva requerida

`supabase/migrations/0004_pagos_parciales.sql` (`data-model.md`) — la única adición/modificación de esquema de esta feature: migra `cuotas.estado` a `TEXT`+`CHECK`, añade la tabla `cobros`, extiende `registrar_cobro`, añade `liquidar_prestamo` y la vista `cartera_tendencia_mensual`. `emitir_prestamo`, `cliente_score`, `cartera_resumen` y el resto del esquema no cambian.
