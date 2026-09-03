# Data Model: App Móvil de Cobranza en Campo

Las entidades persistidas (Cliente, Préstamo, Cuota) reutilizan **tal cual** el esquema SQL de `spec.md` raíz §4 — no se modifica ningún campo, tipo ni restricción. Este documento describe cómo esta feature las consume, y añade únicamente las vistas/reglas que introduce a nivel de aplicación móvil.

## Cliente

Definida en `spec.md` raíz §4 (tabla `clientes`). Campos relevantes para esta feature:

| Campo | Tipo | Uso en esta feature |
|---|---|---|
| `id` | UUID | clave para navegar directorio → perfil → historial de préstamos |
| `nombre` | TEXT | búsqueda del directorio (FR-005), tarjetas, encabezados |
| `telefono` | TEXT | búsqueda del directorio (FR-005), acceso directo a WhatsApp/llamada |
| `direccion` | TEXT | mostrada en el perfil 360° (US4) |
| `notas_privadas` | TEXT | edición desde el perfil (FR-012) |
| `notas_actualizadas_en` | TIMESTAMPTZ | mostrada junto a la nota ("Actualizada 26 ago 2026") |

**Validación de aplicación**: al crear un cliente nuevo desde la calculadora (FR-004), `nombre` y `telefono` son obligatorios; no se captura ningún otro campo en ese flujo mínimo (ver Assumptions de spec.md).

**Regla anti-duplicado (edge case de spec.md)**: antes de insertar un cliente nuevo, la app busca por `telefono` exacto entre los existentes; si hay coincidencia, se ofrece asociar el préstamo a ese cliente en vez de crear uno nuevo.

## Préstamo

Definida en `spec.md` raíz §4 (tabla `prestamos`). Esta feature:

- Crea un registro (`estado='activo'`) al emitir (FR-004), junto con sus N cuotas en una misma operación (ver `contracts/data-contract.md`).
- Nunca actualiza `capital`, `tasa_interes`, `num_cuotas`, `frecuencia` ni `fecha_emision` después de creado — son inmutables (constitución + spec.md raíz §2, "un préstamo emitido es inmutable en sus términos").
- No implementa transición a `liquidado`/`cancelado` en esta fase — fuera de alcance (ver Assumptions de spec.md: "un préstamo activo por cliente a la vez"; liquidación anticipada es Fase 4 del negocio).

**Estado derivado — Saldo del préstamo** (no almacenado, constitución principio IV):

```
saldo = SUM(cuotas.monto_cuota) - SUM(cuotas.monto_pagado WHERE estado = 'pagado')
```

Mostrado en directorio (FR-006), detalle de préstamo y perfil (US4).

## Cuota

Definida en `spec.md` raíz §4 (tabla `cuotas`). Esta feature:

- Lee cuotas en tres vistas distintas (tabla de amortización completa, fila de la ruta de cobranza, cronograma del préstamo) — **misma fuente de datos, sin cálculos duplicados** (Key Entity de spec.md).
- Transiciona una cuota de `pendiente` → `pagado` al confirmar un cobro (FR-008/FR-009), fijando `fecha_pago = now()` y `monto_pagado = monto_cuota` — **nunca** un valor distinto a `monto_cuota`, porque los pagos parciales están fuera de alcance (FR-014).

**Estado derivado — Mora** (no almacenado, constitución principio IV):

```
mora_dias = hoy - fecha_vencimiento   (solo si estado = 'pendiente' Y fecha_vencimiento < hoy; si no, no aplica)
```

Usado de forma idéntica en directorio (FR-006), ruta de cobranza (FR-007) y perfil (edge case "mismo cálculo, no tres números distintos").

## Score de confianza (vista derivada)

Reutiliza `VIEW cliente_score` de `spec.md` raíz §4 sin modificarla. Esta feature la consume para FR-010:

| Campo de la vista | Uso |
|---|---|
| `grado` (A+/A/B/C/NULL) | badge del score |
| `cuotas_pagadas`, `cuotas_historicas` | fracción visible junto al grado (ej. "19 de 20 cuotas") — nunca se muestra `grado` solo |
| `puntualidad` | opcional, para el detalle del cálculo si se necesita |

`grado IS NULL` → estado de aplicación "sin historial" (FR-010, edge case de spec.md).

## Ruta de cobranza (vista derivada, no almacenada)

No es una tabla ni una vista SQL nueva — es una consulta de aplicación (ver `contracts/data-contract.md`) sobre `cuotas` + `prestamos` + `clientes`:

```
SELECT cuotas.*, prestamos.*, clientes.*
FROM cuotas
JOIN prestamos ON prestamos.id = cuotas.prestamo_id
JOIN clientes ON clientes.id = prestamos.cliente_id
WHERE cuotas.estado = 'pendiente'
  AND cuotas.fecha_vencimiento <= hoy
  AND prestamos.estado = 'activo'
ORDER BY cuotas.fecha_vencimiento ASC   -- vencidas primero, luego las de hoy (FR-007)
```

Se recalcula en cada consulta (TanStack Query, ver research.md §3); nunca se persiste una "ruta del día" como entidad propia.

## Nota privada

No es una entidad separada — es el campo `clientes.notas_privadas` + `clientes.notas_actualizadas_en` (ver tabla de Cliente arriba). Se documenta aparte aquí solo porque `spec.md` la lista como Key Entity propia.

## Diagrama de relaciones

```
Cliente (1) ──< Préstamo (0..1 activo a la vez + N liquidados) ──< Cuota (N, fijas desde la emisión)
   │
   └─< Nota privada (1:1, campo embebido)

VIEW cliente_score  ── deriva de ──> Cliente + Préstamo + Cuota (solo lectura)
"Ruta de cobranza"  ── deriva de ──> Cuota + Préstamo + Cliente (solo lectura, filtrada por fecha)
```
