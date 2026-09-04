# Quickstart: Gestión Operativa Integral — Pagos Parciales, Liquidación Anticipada y Tendencia de Cartera

Guía para levantar el entorno y validar de punta a punta las 3 historias de usuario de [spec.md](./spec.md). Reutiliza la misma base de datos que fases anteriores — no hace falta una cartera separada.

## Prerrequisitos

- Node.js ≥20, npm; el stack local de Supabase ya levantado (`specs/001-mobile-field-app/quickstart.md`), con la migración nueva de esta feature aplicada (`0004_pagos_parciales.sql`)
- Un préstamo activo con al menos 3-4 cuotas pendientes (reutilizar el creado en `specs/002-admin-web/quickstart.md`, o emitir uno nuevo desde la calculadora)

## Levantar el entorno

```bash
npm install
npx supabase start
npx supabase db reset
npm run dev -- --filter=web
```

Abrir `http://localhost:5300` (o el puerto que Vite asigne si 5300 está ocupado).

## Validación por historia de usuario

### US1 — Registrar un pago parcial de una cuota (P1)

1. Abrir la tabla de amortización de un préstamo con cuotas pendientes (`/prestamos/:id`). Registrar un cobro por un monto MENOR al de una cuota (ej. $20 de una cuota de $47.92).
   - **Esperado**: la cuota pasa a "parcial", visualmente distinta de "pendiente" y "pagada"; el saldo restante de esa cuota baja exactamente en $20.
2. Registrar un segundo cobro sobre la misma cuota, por el resto ($27.92).
   - **Esperado**: la cuota pasa a "pagada"; el acumulado recibido es exactamente $47.92 (SC-003).
3. Intentar registrar un cobro mayor al saldo restante de una cuota pendiente o parcial.
   - **Esperado**: el sistema lo rechaza con un aviso claro (FR-004) — ninguna cuota queda con más de lo que le correspondía.
4. Repetir el paso 1 desde `apps/mobile` (modal "Registrar cobro" del perfil de cliente) sobre otra cuota.
   - **Esperado**: mismo comportamiento — un solo camino de escritura para cuotas, sin importar la superficie (SC-001).

### US2 — Liquidar anticipadamente un préstamo completo (P1)

1. Con un préstamo activo que tenga cuotas pendientes y/o parciales, elegir "Liquidar anticipadamente" desde su tabla de amortización.
   - **Esperado**: se muestra primero el monto total exacto a cobrar (suma de lo que falta en cada cuota) antes de confirmar (FR-005).
2. Confirmar la liquidación.
   - **Esperado**: todas las cuotas pasan a "pagada", el préstamo pasa a "liquidado", y desaparece de "Préstamos activos" de inmediato (SC-002).
3. Intentar liquidar el mismo préstamo de nuevo, o registrar un cobro sobre alguna de sus cuotas.
   - **Esperado**: el sistema lo rechaza con un aviso claro.
4. **Validación de concurrencia (SC-004)**: con un préstamo activo de varias cuotas pendientes, disparar "Liquidar anticipadamente" y, casi al mismo tiempo, un cobro individual sobre una de esas cuotas desde otra sesión.
   - **Esperado**: exactamente una de las dos operaciones se queda con esa cuota puntual; el préstamo termina liquidado igual, sin cobro duplicado ni cuota sin cubrir.

### US3 — Ver la tendencia de ganancias y capital (P2)

1. Con actividad de préstamos/cobros repartida en varios meses (o forzando fechas de prueba si el entorno lo permite), abrir el panel de tendencia del dashboard.
   - **Esperado**: una gráfica con la evolución de capital prestado, total recuperado e intereses ganados, agrupada por mes (SC-005).
2. Con una cartera de un solo mes de actividad.
   - **Esperado**: un estado claro de "historial limitado", no una gráfica de un solo punto ni un error.

## Pruebas automatizadas equivalentes

- `packages/data-supabase`: `npm test --workspace=@repo/data-supabase` — tests de mapeo fila↔dominio para el nuevo estado `'partial'`, `registerInstallmentPayment` (total y parcial), `payoffLoan`, y `getTrend`.
- `apps/web`: `npm test --workspace=web` — un test de integración por historia (registrar pago parcial, liquidar anticipadamente, ver tendencia).
- `apps/mobile`: `npm test --workspace=mobile` — regresión de las pantallas que hoy llaman al método reemplazado (`ClientProfileScreen`, `CollectionRouteScreen`), más el nuevo flujo de monto editable.
- `packages/core`: sin cambios de comportamiento — `npm test --workspace=@repo/core` debe seguir pasando sin tests nuevos (solo tipos/firmas, constitución Principio III).
