# Data Model: Auditoría de Consistencia con el Mockup Inicial

Este documento no describe una base de datos ni tablas persistentes (la auditoría no introduce estado nuevo — ver Constitution Check, principio IV). Describe la estructura de las entidades que componen el **reporte de auditoría**, tal como las define `spec.md` en su sección "Key Entities".

## Entidad: Pantalla auditada (Screen)

Representa una vista comparable entre el mockup y la aplicación.

| Campo | Tipo | Descripción | Reglas |
|---|---|---|---|
| `id` | string | Identificador corto de la pantalla en el reporte (p. ej. `mobile-quote-calculator`) | Único dentro del reporte |
| `nombre` | string | Nombre legible (p. ej. "Calculadora de préstamos") | — |
| `plataforma` | enum(`movil`, `web`) | Plataforma de la app auditada | — |
| `artboard_mockup` | string \| `null` | Id(s) de artboard del mockup (p. ej. `1a, 2a`) | `null` si no hay mockup de referencia (ver `sin_referencia`) |
| `archivos_codigo` | string[] | Rutas de archivo(s) que implementan la pantalla | Al menos 1 entrada; puede incluir componentes auxiliares (p. ej. un modal) |
| `sin_referencia` | boolean | `true` si no existe artboard correspondiente en el mockup inicial | Si es `true`, `artboard_mockup` MUST ser `null` y `veredicto` MUST ser `sin_referencia` |
| `veredicto` | enum(`coincide`, `no_coincide`, `sin_referencia`) | Resultado general de la comparación | Determinado por la presencia de hallazgos con severidad ≥ menor |

### Catálogo inicial de pantallas (poblado en Phase 0, ver `research.md` §2–3)

| id | plataforma | artboard_mockup | archivos_codigo |
|---|---|---|---|
| `mobile-quote-calculator` | movil | 1a, 2a | `apps/mobile/src/screens/QuoteCalculatorScreen.tsx` |
| `mobile-client-detail-payment` | movil | 1b | `apps/mobile/src/screens/LoanDetailScreen.tsx`, `apps/mobile/src/components/RegisterPaymentModal.tsx` |
| `mobile-client-directory` | movil | 2b | `apps/mobile/src/screens/ClientDirectoryScreen.tsx` |
| `mobile-client-360-profile` | movil | 2c | `apps/mobile/src/screens/ClientProfileScreen.tsx` |
| `mobile-collection-route` | movil | 2d | `apps/mobile/src/screens/CollectionRouteScreen.tsx` |
| `web-dashboard-amortization` | web | 1c | `apps/web/src/pages/DashboardPage.tsx`, `apps/web/src/pages/LoanAmortizationPage.tsx` |
| `web-client-crm-drawer` | web | 2e | `apps/web/src/pages/ClientDirectoryPage.tsx`, `apps/web/src/components/ClientDetailDrawer.tsx` |
| `mobile-issue-loan-sheet` | movil | *(ninguno)* | `apps/mobile/src/components/IssueLoanSheet.tsx` |
| `web-quote-calculator` | web | *(ninguno)* | `apps/web/src/pages/QuoteCalculatorPage.tsx` |
| `web-active-loans` | web | *(ninguno)* | `apps/web/src/pages/ActiveLoansPage.tsx` |
| `web-whatsapp-config` | web | *(ninguno)* | `apps/web/src/pages/WhatsAppConfigPage.tsx` |

Las primeras 7 filas cubren los 8 artboards del mockup inicial (FR-001; `mobile-quote-calculator` cubre tanto `1a` como `2a`, y `mobile-client-360-profile` cubre `2c`). Las últimas 4 filas son las pantallas `sin_referencia` identificadas en Phase 0.

**Corrección post-lectura de código (durante `/speckit-implement`)**: el mapeo original de Phase 1 invirtió `LoanDetailScreen.tsx` y `ClientProfileScreen.tsx` entre `1b` y `2c` (una suposición hecha por nombre de pantalla, antes de leer el código). Al ejecutar la auditoría se confirmó que `LoanDetailScreen.tsx` (progreso del préstamo + cronograma + registro de cobro) corresponde a `1b`, y `ClientProfileScreen.tsx` (score + notas + historial de préstamos) corresponde a `2c`. La tabla de arriba ya refleja la corrección; ver `REPORT.md` para el detalle.

## Entidad: Componente compartido auditado (Shared Component)

Caso especial de "Pantalla auditada" para elementos reutilizados en múltiples pantallas (edge case de `spec.md`: no duplicar el hallazgo por pantalla).

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | string | p. ej. `shared-button` |
| `archivos_codigo` | string[] | `packages/ui/src/primitives/Button.tsx`, `packages/ui/src/primitives-web/Button.tsx` |
| `pantallas_que_lo_usan` | string[] | Lista de `id` de "Pantalla auditada" donde aparece |
| `veredicto` | enum(`coincide`, `no_coincide`) | No aplica `sin_referencia` porque el mockup sí define botones primario/secundario en múltiples artboards |

## Entidad: Hallazgo (Discrepancy)

| Campo | Tipo | Descripción | Reglas |
|---|---|---|---|
| `pantalla_id` | string | FK a `Screen.id` o `SharedComponent.id` | Debe existir en el catálogo |
| `categoria` | enum(`color`, `tipografia`, `layout`, `boton`) | Categoría del FR-002 | — |
| `descripcion` | string | Diferencia concreta, reproducible sin reabrir el mockup | Debe citar el valor esperado (mockup/token) vs. el valor encontrado en código |
| `severidad` | enum(`bloqueante`, `menor`, `cosmetico`) | Según FR-004 | `bloqueante` si contradice una decisión de marca/estado (p. ej. color de error usado para éxito) |
| `referencia_artboard` | string \| `null` | Id de artboard citado (p. ej. `2a`) | `null` solo si `pantalla_id` es `sin_referencia` y el hallazgo es sobre una inconsistencia interna, no contra el mockup |
| `archivo_codigo` | string | Ruta exacta + referencia de línea si aplica | — |

## Entidad: Reporte de auditoría (Audit Report)

Documento único (`REPORT.md`) que agrupa:

1. Una tabla resumen con una fila por cada "Pantalla auditada" (incluyendo `Shared Component`), con columnas `pantalla`, `plataforma`, `artboard(s)`, `veredicto`.
2. Una sección detallada por pantalla, anclada por `id`, listando sus `Hallazgo`s (o "sin discrepancias" si no hay ninguno).
3. Una sección final de pantallas `sin_referencia`, listadas sin veredicto de coincidencia.

El formato exacto de estas secciones se fija como contrato en `contracts/audit-report-format.md` para que `/speckit-tasks` y `/speckit-implement` puedan generarlo de forma determinista.

## Reglas de validación transversales

- Toda fila del catálogo de pantallas MUST terminar con un `veredicto` no vacío (FR-007, SC-001).
- Un `veredicto = coincide` implica cero hallazgos de severidad `bloqueante` o `menor` para esa pantalla (los `cosmetico` no bloquean el veredicto `coincide`, pero MUST listarse igual).
- Un `veredicto = sin_referencia` MUST tener `artboard_mockup = null` y no computar contra SC-004 (que solo mide hallazgos `bloqueante` sobre las 8 pantallas con mockup).
