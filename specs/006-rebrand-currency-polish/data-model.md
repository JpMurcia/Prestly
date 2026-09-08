# Data Model: Marca Prestly, selector de moneda y cierre de brechas de mockup

## Configuración de moneda (`configuracion_app`, tabla nueva)

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `SMALLINT PRIMARY KEY` | `CHECK (id = 1)` — fuerza fila única (singleton), mismo criterio que "una sola instalación single-tenant" (spec.md raíz §1) |
| `moneda` | `TEXT NOT NULL DEFAULT 'COP'` | `CHECK (moneda IN ('COP','USD','MXN'))` |
| `actualizado_en` | `TIMESTAMPTZ NOT NULL DEFAULT now()` | se refresca en cada `UPDATE` (trigger simple o seteado explícito por el repositorio) |

Se inserta la fila `(1, 'COP')` como parte de la propia migración (no del seed) — la app debe tener una moneda configurada incluso en un ambiente que nunca corrió `seed.sql` (producción). Sin RLS, sin funciones RPC — ver research.md §1.

**Por qué no una tabla clave-valor genérica**: hoy solo hay un ajuste (moneda); generalizar antes de un segundo caso sería anticipar necesidad no confirmada (Principio V, YAGNI).

## Metadata de monedas (`@repo/core`, sin tabla — dato estático en código)

| Código | Símbolo | Locale | Decimales | Nombre para mostrar |
|---|---|---|---|---|
| `COP` | `$` | `es-CO` | 0 | Peso colombiano |
| `USD` | `$` | `en-US` | 2 | Dólar estadounidense |
| `MXN` | `$` | `es-MX` | 2 | Peso mexicano |

No vive en la base de datos porque no cambia por instalación ni la edita el usuario — es la lista fija de monedas que la app *sabe* formatear (research.md §2). Agregar una cuarta moneda en el futuro es agregar una fila a esta tabla estática + al `CHECK` de la columna `moneda`, sin tocar lógica.

## Cliente (`clientes`, sin cambios de esquema)

Reutilizada tal cual (spec.md raíz §4). El único cambio es de **flujo**: hoy `IClientWriter.create` solo se invoca desde dentro de `issueLoan` (a través de `resolveClientId`); esta fase agrega un segundo llamador (`createStandaloneClient`) que lo invoca directamente, sin crear ningún préstamo. No se agrega ninguna columna ni se cambia la restricción de que `telefono` no tiene `UNIQUE` a nivel de base de datos — la anti-duplicación sigue siendo una regla de aplicación (`findByPhone` antes de `create`), igual que hoy.

## Préstamo / Cuota (`prestamos`/`cuotas`, sin cambios de esquema)

Reutilizadas tal cual. Las columnas ya existentes (`monto_capital`, `monto_interes`, `monto_cuota`, `monto_pagado`) alimentan directamente la nueva columna "Saldo restante" de la tabla de amortización web (`monto_cuota - COALESCE(monto_pagado, 0)`, mismo cálculo que ya usa `computePortfolio` en `SupabaseClientRepository.ts` para el saldo del directorio) y la tarjeta "Cobrado" del drawer (`SUM(monto_pagado)` de las cuotas del préstamo activo del cliente). Ninguna requiere una columna derivada nueva (Principio IV).

## Diagrama de relaciones (nuevo elemento resaltado)

```
clientes 1──* prestamos 1──* cuotas

configuracion_app (1 fila fija) ── leída/escrita directo por supabase-js, sin relación con clientes/prestamos
```

## Entidades de UI (sin persistencia propia — se derivan de datos ya existentes)

- **KPIs del directorio web** (clientes activos, préstamo promedio, tasa de reincidencia): calculados en memoria a partir de la lista ya devuelta por `IClientReader.list()` — igual criterio que los contadores por filtro que ya existen en `ClientDirectoryPage.tsx` (`useMemo`), sin una consulta nueva.
- **"Score medio" y "Saldo agregado" del pie de tabla**: mismo criterio — agregado en memoria sobre la lista ya cargada, no una vista SQL nueva.
