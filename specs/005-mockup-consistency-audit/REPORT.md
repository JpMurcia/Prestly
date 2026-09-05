# Auditoría de Consistencia con el Mockup Inicial

**Fecha**: 2026-09-04
**Mockup de referencia**: `Docs/Plataforma Mockus/Microcreditos - Mockups.dc.html` (2 turnos, 8 artboards: `1a`,`1b`,`1c`,`2a`,`2b`,`2c`,`2d`,`2e`)
**Cobertura**: 8/8 artboards revisados (11/11 entradas del catálogo, incluyendo 4 pantallas sin referencia y el componente compartido `Button`)

**Nota de corrección de mapeo**: la planificación inicial (`data-model.md`, Phase 1) supuso, por nombre de archivo, que `ClientProfileScreen.tsx` cubría el artboard `1b` y `LoanDetailScreen.tsx` el `2c`. Al leer el código para esta auditoría se confirmó que es al revés: `LoanDetailScreen.tsx` (progreso del préstamo + cronograma + registro de cobro) es la contraparte de `1b`, y `ClientProfileScreen.tsx` (score + notas + historial de préstamos) es la contraparte de `2c`. `data-model.md` y `plan.md` ya se corrigieron; este reporte usa el mapeo correcto.

**Referencia auxiliar de tokens (FR-006)**: `packages/ui/src/tokens/colors.ts` — `emerald #10B981`, `navy #1E3A8A`, `ink #0F172A`, estados `alDia {#15803D/#F0FDF4}`, `cobroHoy {#B45309/#FFFBEB}`, `mora {#B91C1C/#FEF2F2}`, score `aPlus {#047857/#ECFDF5}` / `a {#15803D/#F0FDF4}` / `b {#B45309/#FFFBEB}` / `c {#B91C1C/#FEF2F2}`, neutros `50 #F8FAFC · 100 #F1F5F9 · 200 #E2E8F0 · 400 #94A3B8 · 500 #64748B · 900 #0F172A`. `packages/ui/src/tokens/typography.ts` — `Plus Jakarta Sans` (700/800 Bold/ExtraBold) para cifras/títulos, `Inter` (400/500/600/700) para cuerpo/labels, `tabular-nums` + alineación derecha obligatorios en montos. Ambos archivos citan explícitamente el mockup como su origen y coinciden con los valores encontrados en los artboards.

## Resumen ejecutivo

| Pantalla | Plataforma | Artboard(s) | Veredicto |
|---|---|---|---|
| Calculadora de préstamos | móvil | 1a, 2a | ⚠️ No coincide |
| Detalle del préstamo y registro de pago | móvil | 1b | ⚠️ No coincide |
| Directorio de clientes y cartera | móvil | 2b | ⚠️ No coincide |
| Perfil 360° del cliente | móvil | 2c | ⚠️ No coincide |
| Ruta de cobranza | móvil | 2d | ⚠️ No coincide |
| Dashboard administrativo y amortización | web | 1c | ⚠️ No coincide |
| CRM de clientes con drawer | web | 2e | ⚠️ No coincide |
| Hoja de emisión de préstamo (IssueLoanSheet) | móvil | — | ➖ Sin referencia |
| Calculadora (web) | web | — | ➖ Sin referencia |
| Préstamos activos (lista) | web | — | ➖ Sin referencia |
| Automatización WhatsApp | web | — | ➖ Sin referencia |

**Hallazgos bloqueantes**: 0 — **Hallazgos menores**: 27 — **Hallazgos cosméticos**: 6

Ninguna pantalla usa un color de marca o de estado de forma incorrecta (p. ej. rojo de mora como si fuera éxito); todos los "no coincide" son por **layout simplificado, elementos del mockup ausentes, o un matiz de color puntual**, no por confusión de significado. Ver detalle por pantalla.

## Detalle por pantalla

### mobile-quote-calculator · Calculadora de préstamos

- **Plataforma**: móvil
- **Artboard(s)**: 1a, 2a
- **Archivo(s)**: `apps/mobile/src/screens/QuoteCalculatorScreen.tsx`
- **Veredicto**: ⚠️ No coincide

| Categoría | Severidad | Descripción | Referencia mockup | Archivo |
|---|---|---|---|---|
| layout | menor | El mockup abre con una barra de admin (avatar+nombre "Carlos Méndez") y un tile "Caja $4,280"; la pantalla no tiene ningún header de este tipo, solo el título "Calculadora". | 1a | `apps/mobile/src/screens/QuoteCalculatorScreen.tsx:79` |
| layout | menor | El mockup usa sliders (monto/interés/cuotas) con rango visible (p. ej. $100–$1,000); la pantalla usa `TextInput` numéricos simples sin slider ni rango visible. | 1a | `apps/mobile/src/screens/QuoteCalculatorScreen.tsx:84-110` |
| layout | menor | 2a muestra el monto/interés/frecuencia/cuotas como chips de solo lectura + acción "Ajustar" (implica un editor aparte); la pantalla los deja siempre editables inline, sin esa capa de resumen. | 2a | `apps/mobile/src/screens/QuoteCalculatorScreen.tsx:82-124` |
| color | menor | La tarjeta de "Total a pagar" es un degradado verde (`linear-gradient(135deg,#10B981,#059669)`) con texto blanco en el mockup; el código usa una tarjeta plana `bg-[#ECFDF5]` (verde muy claro) con texto oscuro — mismo verde de marca, tratamiento visual distinto. | 1a, 2a | `apps/mobile/src/screens/QuoteCalculatorScreen.tsx:128` |
| boton | menor | El botón de compartir en 2a es "Compartir tabla por WhatsApp" con ícono de WhatsApp y fondo blanco; el código lo llama "Compartir tabla" (sin "por WhatsApp") y usa el share nativo del SO (no siempre WhatsApp), sin ícono. | 2a | `apps/mobile/src/screens/QuoteCalculatorScreen.tsx:186` |
| boton | cosmético | El alternador "Ver resumen/Ver tabla completa" en el mockup es un segmented control de dos pestañas con fondo blanco elevado en la activa; el código lo implementa como un solo texto centrado que cambia de etiqueta (mismo comportamiento, look distinto). | 2a | `apps/mobile/src/screens/QuoteCalculatorScreen.tsx:150-154` |

**Coincide**: etiqueta del botón principal "Emitir este préstamo" ✓ (exacta); toggle resumen/tabla con el mismo texto exacto ✓; cifras en `tabular-nums` ✓; tabla completa con columnas N°/Vence/Capital/Interés/Cuota y fila de Totales ✓ (coincide con 2a).

### mobile-client-detail-payment · Detalle del préstamo y registro de pago

- **Plataforma**: móvil
- **Artboard(s)**: 1b
- **Archivo(s)**: `apps/mobile/src/screens/LoanDetailScreen.tsx`, `apps/mobile/src/components/RegisterPaymentModal.tsx`
- **Veredicto**: ⚠️ No coincide

| Categoría | Severidad | Descripción | Referencia mockup | Archivo |
|---|---|---|---|---|
| layout | menor | El mockup muestra 3 tiles (Prestado/Cobrado/Saldo); la pantalla solo muestra 2 (Prestado/Saldo), sin "Cobrado". | 1b | `apps/mobile/src/screens/LoanDetailScreen.tsx:102-111` |
| layout | menor | Cada fila del cronograma en el mockup tiene un ícono circular (check/reloj) y, para "vence hoy", fondo y borde-izquierdo ámbar (`#FFFBEB`/`#F59E0B`); el código usa filas neutras sin ícono ni acento de color por estado. | 1b | `apps/mobile/src/screens/LoanDetailScreen.tsx:133-176` |
| color | cosmético | El header de cliente en el mockup es una tarjeta separada (avatar+nombre+teléfono+ícono WhatsApp+badge "Al día"); el código solo pone el nombre como título de pantalla, sin esa tarjeta ni el badge de estado. | 1b | `apps/mobile/src/screens/LoanDetailScreen.tsx:95` |
| boton | menor | El mockup tiene una fila con checkbox "Enviar comprobante por WhatsApp" dentro del propio modal de cobro; el código no la tiene ahí — el envío por WhatsApp se reubicó como un enlace "WhatsApp" independiente por cada cuota ya pagada en la pantalla de detalle (`apps/mobile/src/screens/LoanDetailScreen.tsx:149`), consecuencia de la automatización de `specs/004-whatsapp-automation/`. | 1b | `apps/mobile/src/components/RegisterPaymentModal.tsx` |
| boton | cosmético | El mockup ofrece 3 chips de método de pago ("Efectivo"/"Transferencia"/"Parcial"); el código solo tiene 2 (`Efectivo`/`Transferencia`) — "Parcial" ya no es una selección manual porque `specs/003-operational-management/` automatizó la detección de pago parcial comparando el monto recibido contra el saldo. | 1b | `apps/mobile/src/components/RegisterPaymentModal.tsx:108-116` |

**Coincide**: título "Registrar cobro" + "Cerrar" ✓; tile "Recibido" con borde verde `#10B981` resaltado ✓; callout "Cambio a entregar" en verde `#ECFDF5`/`#047857` ✓; botón final "Confirmar cobro" en verde sólido ✓; texto "Compartir tabla por WhatsApp" en la pantalla de detalle coincide literalmente con el mockup ✓.

**Nota de alcance**: el botón "Liquidar anticipadamente" y el aviso de pago parcial son adiciones de `specs/003-operational-management/` sin artboard propio — no se evalúan como discrepancia porque el mockup es anterior a esa decisión de producto.

### mobile-client-directory · Directorio de clientes y cartera

- **Plataforma**: móvil
- **Artboard(s)**: 2b
- **Archivo(s)**: `apps/mobile/src/screens/ClientDirectoryScreen.tsx`
- **Veredicto**: ⚠️ No coincide

| Categoría | Severidad | Descripción | Referencia mockup | Archivo |
|---|---|---|---|---|
| boton | menor | El header del mockup es "Clientes" + enlace "+ Nuevo"; el código titula "Directorio" y no ofrece ninguna acción para crear un cliente directamente desde esta pantalla (solo existe dentro del flujo de emisión de préstamo). | 2b | `apps/mobile/src/screens/ClientDirectoryScreen.tsx:54` |
| color/layout | menor | Los chips de filtro del mockup son pastillas (`border-radius:999px`) con un color distinto por categoría (negro "Todos", ámbar "Cobranza hoy", blanco "Al día", blanco/rojo "Mora"); el `Chip` compartido usa `rounded-lg` (esquina ~8px, no pastilla) y solo 2 estilos (seleccionado/no seleccionado), sin variar color por categoría. Aplica a los 4 chips de filtro de esta pantalla. | 2b | `packages/ui/src/primitives/Chip.tsx:19-21` |
| boton | menor | Cada fila de cliente en el mockup incluye un botón de ícono de WhatsApp (44×40, fondo `#ECFDF5`) junto al botón principal; la tarjeta de cliente del código no tiene ningún botón de WhatsApp, solo "Cobrar $X"/"Ver detalle". | 2b | `apps/mobile/src/screens/ClientDirectoryScreen.tsx:136-152` |

**Coincide**: placeholder del buscador "Buscar por nombre o teléfono" es una coincidencia literal ✓; estructura general de tarjeta (avatar+nombre+badge+saldo+progreso+acciones) ✓; colores de badges de estado (Al día/Mora/Cobra hoy) vía `packages/ui/src/tokens/colors.ts` ✓.

### mobile-client-360-profile · Perfil 360° del cliente

- **Plataforma**: móvil
- **Artboard(s)**: 2c
- **Archivo(s)**: `apps/mobile/src/screens/ClientProfileScreen.tsx`
- **Veredicto**: ⚠️ No coincide

| Categoría | Severidad | Descripción | Referencia mockup | Archivo |
|---|---|---|---|---|
| layout/color | menor | El mockup tiene un header oscuro (`#0F172A`) con avatar, nombre grande en blanco, "cliente desde…" y dirección/teléfono; el código no tiene ningún header oscuro — el nombre es un título de texto plano sobre fondo claro, sin avatar ni fecha de alta ni dirección. | 2c | `apps/mobile/src/screens/ClientProfileScreen.tsx:50-51` |
| layout | menor | La tarjeta de score en el mockup es una insignia grande (62×62) con texto "Excelente historial" + una barra de 12 segmentos coloreados por cuota; el código muestra solo un `Badge` de una línea con la fracción de texto, sin segmentos ni titular. | 2c | `apps/mobile/src/screens/ClientProfileScreen.tsx:53-67` |
| boton | menor | "Notas privadas" en el mockup es de solo lectura con un enlace "Editar" para entrar en modo edición; el código deja el campo siempre editable con un botón "Guardar nota" — mismo color ámbar de fondo, interacción distinta. | 2c | `apps/mobile/src/screens/ClientProfileScreen.tsx:69-86` |
| layout | menor | Cada préstamo del historial en el mockup muestra barra de progreso, tenor/tasa y (si está cerrado) fecha de cierre + interés generado; el código solo muestra monto, badge de estado y fracción de cuotas en texto. | 2c | `apps/mobile/src/screens/ClientProfileScreen.tsx:89-104` |
| boton | menor | El mockup tiene una barra inferior fija con 3 botones (llamar, WhatsApp, "Nuevo préstamo"); la pantalla no tiene ninguna barra de acciones inferior. | 2c | `apps/mobile/src/screens/ClientProfileScreen.tsx` |

**Coincide**: colores de las bandas de score A+/A/B/C (`#ECFDF5`/`#047857`, `#F0FDF4`/`#15803D`, `#FFFBEB`/`#B45309`, `#FEF2F2`/`#B91C1C`) igual a `packages/ui/src/tokens/colors.ts` y al mockup ✓; fondo ámbar de "Notas privadas" ✓.

### mobile-collection-route · Ruta de cobranza

- **Plataforma**: móvil
- **Artboard(s)**: 2d
- **Archivo(s)**: `apps/mobile/src/screens/CollectionRouteScreen.tsx`
- **Veredicto**: ⚠️ No coincide

| Categoría | Severidad | Descripción | Referencia mockup | Archivo |
|---|---|---|---|---|
| color | menor | La cifra grande "Cobro esperado hoy" es menta `#34D399` en el mockup; el código la pinta `text-white`. | 2d | `apps/mobile/src/screens/CollectionRouteScreen.tsx:28` |
| layout | menor | Falta la fila de puntos de progreso (barras de estado por cliente) y el pie "X de Y registrados · $Z cobrados" que acompañan la cifra en el mockup. | 2d | `apps/mobile/src/screens/CollectionRouteScreen.tsx:26-34` |
| color | menor | Para la fila "vence hoy", el mockup tinta el fondo de la tarjeta (`#FFFDF5`) además del borde izquierdo ámbar; el código deja el fondo blanco siempre (`bg-white`) y solo cambia el color del borde izquierdo (rojo para mora, ámbar para "vence hoy"). | 2d | `apps/mobile/src/screens/CollectionRouteScreen.tsx:72-74` |
| boton | cosmético | El botón de acción por fila es cuadrado redondeado (10px) en el mockup; el código lo hace circular (`rounded-full`). | 2d | `apps/mobile/src/screens/CollectionRouteScreen.tsx:90` |
| layout | menor | Falta la sección "Próximos 7 días" y las filas ya cobradas (con nombre tachado y ✓ verde) que aparecen debajo de la ruta del día en el mockup — la lista del código solo trae las cuotas pendientes de hoy/mora. | 2d | `apps/mobile/src/screens/CollectionRouteScreen.tsx:45-49` |

**Coincide**: el motivo central del "Fila de cobranza" — barra de acento izquierda por color de estado (rojo mora / ámbar hoy) sin relleno de fondo salvo la excepción de arriba — está implementado ✓; textos "Mora N días"/"Vence hoy" ✓; título "Ruta de hoy" es una variación razonable de "Ruta por prioridad" del mockup.

### web-dashboard-amortization · Dashboard administrativo y amortización

- **Plataforma**: web
- **Artboard(s)**: 1c
- **Archivo(s)**: `apps/web/src/pages/DashboardPage.tsx`, `apps/web/src/pages/LoanAmortizationPage.tsx`, `apps/web/src/layout/AppShell.tsx`
- **Veredicto**: ⚠️ No coincide

| Categoría | Severidad | Descripción | Referencia mockup | Archivo |
|---|---|---|---|---|
| layout | menor | Cada tarjeta de métrica en el mockup tiene un ícono en un cuadro de color junto al título; las `MetricCard` del código no tienen ícono. | 1c | `apps/web/src/pages/DashboardPage.tsx:79-100` |
| layout | menor | El mockup muestra una línea secundaria de comparación (p. ej. "↑ 12.4% vs. mes anterior") en las 4 tarjetas; el código solo la muestra en la tarjeta de "Cartera en mora" (`hint`), las otras 3 no tienen esa segunda línea. | 1c | `apps/web/src/pages/DashboardPage.tsx:23-25` |
| layout | menor | Falta el widget "Cobros de hoy" (monto en menta + "N cuotas por registrar") anclado al fondo del sidebar en el mockup; `AppShell` no lo implementa. | 1c, 2e | `apps/web/src/layout/AppShell.tsx` |
| layout | menor | La tabla de amortización del mockup tiene 8 columnas (incluye "Saldo restante"); la tabla del código tiene 7, sin columna de saldo restante. | 1c | `apps/web/src/pages/LoanAmortizationPage.tsx:151-161` |
| boton | cosmético | Las pestañas de filtro del mockup muestran el conteo inline ("Todas · 12"); las `FilterTab` del código solo muestran la etiqueta sin conteo. | 1c | `apps/web/src/pages/LoanAmortizationPage.tsx:144-148` |
| boton | menor | El mockup tiene un botón "Recordar" por cuota pendiente; no existe un botón equivalente por fila en el código — los recordatorios se automatizaron por completo en `specs/004-whatsapp-automation/` (sin control manual por cuota). | 1c | `apps/web/src/pages/LoanAmortizationPage.tsx` |

**Coincide**: colores exactos de las 4 métricas contra Tailwind/mockup (`#0F172A`, `#059669`≈emerald-600, `#EF4444`≈red-500) ✓; alturas de fila de tabla 44px y de encabezado 38px, exactas al mockup ("Filas de tabla a 44px") ✓; sidebar 232px, fondo `#0F172A`, ítem activo con `bg-brand-navy` ✓; logo "m" en cuadro emerald + "Microcréditos" ✓; botones "Registrar"/WhatsApp por fila ✓ (aunque "Registrar" ahora acepta un monto editable por pagos parciales, `specs/003-operational-management/`, evolución razonable, no un defecto).

### web-client-crm-drawer · CRM de clientes con drawer

- **Plataforma**: web
- **Artboard(s)**: 2e
- **Archivo(s)**: `apps/web/src/pages/ClientDirectoryPage.tsx`, `apps/web/src/components/ClientDetailDrawer.tsx`
- **Veredicto**: ⚠️ No coincide

| Categoría | Severidad | Descripción | Referencia mockup | Archivo |
|---|---|---|---|---|
| layout | menor | Faltan las 3 tarjetas KPI (Clientes activos / Préstamo promedio / Tasa de reincidencia) que el mockup coloca sobre la tabla. | 2e | `apps/web/src/pages/ClientDirectoryPage.tsx` |
| boton | menor | Falta el botón "Nuevo cliente" (verde, junto a "Exportar CSV") y el avatar de usuario "CM" del header del mockup. | 2e | `apps/web/src/pages/ClientDirectoryPage.tsx:65-75` |
| layout | menor | La tabla del mockup tiene 7 columnas (Cliente/Préstamos/Saldo activo/Comportamiento con score+barra/Próximo pago/Estado/Acciones); la tabla del código tiene 3 (Cliente/Saldo/Estado), sin score, sin próximo pago y sin botones de acción por fila ("Ver perfil"/WhatsApp) — las filas son clicables para abrir el drawer en su lugar. | 2e | `apps/web/src/pages/ClientDirectoryPage.tsx:95-125` |
| layout | menor | Falta la barra de pie de tabla con "Saldo agregado" y "Score medio" que el mockup muestra bajo la tabla. | 2e | `apps/web/src/pages/ClientDirectoryPage.tsx` |
| boton | menor | El drawer del mockup tiene 3 acciones en el header (Registrar cobro / "Perfil completo" / ícono WhatsApp); el drawer del código solo tiene "Registrar cobro" — no existe una vista de "perfil completo" para clientes en la web, y no hay botón de WhatsApp en el header del drawer (el enlace de WhatsApp solo aparece por cuota, más abajo). | 2e | `apps/web/src/components/ClientDetailDrawer.tsx:76-90` |
| layout | menor | El drawer del mockup tiene 3 tiles (Prestado/Cobrado/Saldo) y una barra de progreso de amortización con etiqueta "X de Y · Z%"; el drawer del código tiene 2 tiles (Prestado/Saldo) y no tiene barra de progreso. | 2e | `apps/web/src/components/ClientDetailDrawer.tsx:76-82` |
| layout | cosmético | La mini-tabla de amortización del drawer en el mockup separa Capital e Interés; el código solo muestra el monto total de la cuota. | 2e | `apps/web/src/components/ClientDetailDrawer.tsx:98-108` |

**Coincide**: búsqueda con placeholder equivalente ("Buscar cliente o teléfono…" vs. "Buscar cliente, teléfono o cédula…", texto cercano) ✓; alturas de fila 56px / encabezado 38px exactas al mockup ✓; overlay + panel de 420–520px anclado a la derecha con sombra ✓; botón "Registrar cobro $X" en verde sólido ✓; ancho del sidebar y colores de marca compartidos con 1c ✓.

## Componentes compartidos

### shared-button · Button (primitivo compartido)

- **Archivos**: `packages/ui/src/primitives/Button.tsx`, `packages/ui/src/primitives-web/Button.tsx`
- **Pantallas donde se usa**: todas las de móvil y web listadas arriba (excepto donde se usan enlaces/`<a>` de texto en vez de `Button`, p. ej. los botones "Compartir"/"WhatsApp" de varias pantallas, que están hechos como `Pressable`/`<a>` con estilos propios en vez de reutilizar el primitivo)
- **Veredicto**: ✅ Coincide

El primitivo `Button` (variantes `primary`/`secondary`/`ghost`) usa verde sólido `bg-brand-emerald` (`#10B981`) para la acción primaria y borde neutro blanco para la secundaria, exactamente como especifica el panel "Componentes" del sistema visual del mockup (turno 1, sección de diseño). Sin hallazgos.

**Nota de consistencia**: varios botones "de acción" del mockup (compartir por WhatsApp, íconos de WhatsApp, enlaces "Ver detalle"/"Ordenar"/"Filtrar") se implementan en el código como `Pressable`/`<a>` con clases Tailwind ad-hoc en vez de instanciar el primitivo `Button`/`Chip` compartido. Esto no es en sí un error visual, pero es la causa raíz de varias de las inconsistencias de esta auditoría (p. ej. el botón de compartir sin ícono de WhatsApp) — unificar estos casos sobre los primitivos compartidos reduciría el drift futuro frente al mockup.

### shared-chip · Chip (primitivo compartido)

- **Archivos**: `packages/ui/src/primitives/Chip.tsx`, `packages/ui/src/primitives-web/Chip.tsx`
- **Pantallas donde se usa**: `mobile-quote-calculator` (frecuencia), `mobile-client-directory` (filtros), `mobile-client-detail-payment` (método de pago), `web-client-crm-drawer` (filtros de estado), `web-dashboard-amortization` (no usa `Chip`, usa `FilterTab` propio)
- **Veredicto**: ⚠️ No coincide

| Categoría | Severidad | Descripción | Referencia mockup | Archivo |
|---|---|---|---|---|
| layout | menor | El mockup dibuja sus chips de filtro/parámetro como pastillas completamente redondeadas (`border-radius:999px`); el `Chip` compartido usa `rounded-lg` (~8px), una esquina mucho menos redondeada, en las dos plataformas. | 1a, 2a, 2b, 2e | `packages/ui/src/primitives/Chip.tsx:19`, `packages/ui/src/primitives-web/Chip.tsx:18` |
| color | cosmético | El mockup varía el color de fondo/texto de un chip de filtro según la categoría que representa (negro para "Todos", ámbar para "Cobranza hoy", blanco/rojo para "Mora", etc.); el `Chip` compartido solo tiene 2 estados (seleccionado = negro, no seleccionado = gris), sin variar por categoría. | 2b, 2e | `packages/ui/src/primitives/Chip.tsx:20-21` |

### shared-card-progressbar · Card / ProgressBar (primitivos compartidos)

- **Archivos**: `packages/ui/src/primitives{,-web}/Card.tsx`, `packages/ui/src/primitives{,-web}/ProgressBar.tsx`
- **Veredicto**: ⚠️ No coincide (solo `ProgressBar`; `Card` coincide)

`Card` (`rounded-xl` = 12px, borde `border-neutral-200` = `#E2E8F0`, fondo blanco) coincide exactamente con la especificación del mockup ("Radios: … 12px tarjetas" y fondo/borde citados en su propio comentario) — ✅ sin hallazgos.

| Categoría | Severidad | Descripción | Referencia mockup | Archivo |
|---|---|---|---|---|
| color | cosmético | El track de `ProgressBar` usa `bg-neutral-100` (`#F1F5F9`); el mockup usa consistentemente `#E2E8F0` (neutral-200) para el fondo de sus barras de progreso. | 1b, 2b, 2e | `packages/ui/src/primitives/ProgressBar.tsx:13` |
| layout | cosmético | La altura de `ProgressBar` es 8px (`h-2`); el mockup especifica 6px ("Barra de amortización · 6px"). | 1b, 2b, 2e | `packages/ui/src/primitives/ProgressBar.tsx:13` |

## Pantallas sin mockup de referencia

| Pantalla | Plataforma | Archivo(s) | Motivo |
|---|---|---|---|
| Hoja de emisión de préstamo | móvil | `apps/mobile/src/components/IssueLoanSheet.tsx` | Paso de búsqueda/alta de cliente al emitir; el mockup nunca dibujó este sub-flujo (solo el botón "Crear y emitir préstamo"/"Emitir este préstamo" que lo dispara) |
| Calculadora (web) | web | `apps/web/src/pages/QuoteCalculatorPage.tsx` | El mockup solo mostró la calculadora en móvil (1a/2a); la versión web reutiliza las mismas etiquetas de botón ("Emitir este préstamo", "Compartir tabla por WhatsApp") por paridad de copy, pero no tiene artboard propio |
| Préstamos activos (lista) | web | `apps/web/src/pages/ActiveLoansPage.tsx` | El ítem de navegación "Préstamos activos" existe en el sidebar del mockup (1c/2e), pero el mockup solo dibujó el detalle de amortización de UN préstamo (`app.microcreditos.io/prestamos/1042`), nunca la lista de todos los préstamos activos |
| Automatización WhatsApp | web | `apps/web/src/pages/WhatsAppConfigPage.tsx` | Funcionalidad de `specs/004-whatsapp-automation/`, posterior al mockup inicial; el ítem de sidebar "Configuración" del mockup es un placeholder genérico, no una pantalla de WhatsApp dibujada |

## Priorización sugerida

No hay hallazgos **bloqueantes** — ninguna pantalla usa un color de marca/estado de forma contradictoria, y todas las etiquetas de botón principales (Emitir, Confirmar cobro, Registrar cobro) coinciden literalmente con el mockup. La priorización es entre **menor** (afecta la fidelidad visual/funcional visible) y **cosmético** (detalle sutil, puede posponerse).

### Menores (27) — agrupados por tema, de mayor a menor impacto percibido

1. **Tablas/listas con columnas o secciones faltantes respecto al mockup** — `web-client-crm-drawer` (tabla de 3 columnas en vez de 7, sin KPIs, sin pie de resumen), `web-dashboard-amortization` (falta columna "Saldo restante"), `mobile-client-360-profile` (historial de préstamos sin progreso/tenor), `mobile-collection-route` (sin sección "Próximos 7 días" ni filas cobradas).
2. **Botones/acciones del mockup ausentes en el código** — WhatsApp por fila en `mobile-client-directory` y en el header del drawer de `web-client-crm-drawer`; "+ Nuevo"/"Nuevo cliente" en directorios móvil y web; "Perfil completo" en el drawer web; "Recordar" por cuota en `web-dashboard-amortization` (reemplazado por automatización, ver nota).
3. **Elementos de layout del "sistema visual" no trasladados** — header de admin/caja en `mobile-quote-calculator`; header oscuro de perfil y barra de acciones inferior en `mobile-client-360-profile`; widget "Cobros de hoy" del sidebar en `AppShell`; tile "Cobrado" ausente en 3 pantallas (`mobile-client-detail-payment`, `web-client-crm-drawer`) — patrón repetido, revisar junto.
4. **Color puntual fuera del token esperado en su contexto** — cifra "$239.60" en `mobile-collection-route` debería ser menta `#34D399`, no blanco; tarjeta hero de `mobile-quote-calculator` sin el degradado verde.
5. **Forma/redondeo de controles interactivos compartidos** — `Chip` no es pastilla (999px) como en el mockup; afecta 4 pantallas por ser un componente compartido.

### Cosméticos (6) — posponer sin riesgo

Segmented control de "Ver resumen/Ver tabla completa" como texto simple; botón circular vs. cuadrado-redondeado en la fila de cobranza; conteo faltante en pestañas de filtro de amortización; separación Capital/Interés en la mini-tabla del drawer; `ProgressBar` con track `#F1F5F9` (debería ser `#E2E8F0`) y altura 8px (debería ser 6px).

## Actualización — correcciones aplicadas (2026-09-04)

A pedido del usuario se corrigieron 3 de los hallazgos de este reporte:

- **`shared-chip` (forma)** — `packages/ui/src/primitives/Chip.tsx` y `packages/ui/src/primitives-web/Chip.tsx` ahora usan `rounded-full` (pastilla) en vez de `rounded-lg`.
- **Botón de WhatsApp faltante en `mobile-client-directory`** — se agregó un botón "WhatsApp" por fila de cliente en `apps/mobile/src/screens/ClientDirectoryScreen.tsx` (abre `wa.me` vía `buildWhatsAppShareLink`, deshabilitado si el teléfono no normaliza).
- **Botón de WhatsApp faltante en `web-client-crm-drawer`** — se agregó un enlace "WA" junto a "Registrar cobro" en `apps/web/src/components/ClientDetailDrawer.tsx`, mismo patrón que los enlaces de recibo ya existentes en ese archivo.

**Bug de build no relacionado, encontrado al verificar el fix de Chip visualmente**: `apps/web` (Tailwind v4 sin `tailwind.config.js`) nunca escaneaba `packages/ui/src` en busca de clases — cualquier clase usada *solo* dentro de `packages/ui` (como `rounded-full` en `Chip`/`Badge`) se generaba en el HTML pero no tenía regla CSS correspondiente, así que no tenía ningún efecto visual en la web (aunque sí funcionaba en móvil, cuyo `tailwind.config.js` sí declara ese `content` path). Esto afectaba a **todos los `Badge` del sitio web**, no solo al `Chip`, desde antes de esta auditoría. Se corrigió agregando `@source "../../../packages/ui/src";` en `apps/web/src/index.css`. Verificado en el navegador: `border-radius` computado pasó de `0px` a la pastilla completa.

No se tocó el resto de hallazgos "menores"/"cosméticos" de este reporte — quedan como trabajo de seguimiento futuro si el equipo lo decide.

## Validación (`quickstart.md`)

- **SC-001** ✅ — Las 11 filas del catálogo (7 con artboard + 4 sin referencia) tienen veredicto en el resumen ejecutivo.
- **SC-002** ✅ — Se verificaron al azar 2 hallazgos (color `#34D399` en `mobile-collection-route:28`, y la columna faltante en `web-dashboard-amortization:151-161`): ambos se localizan en el archivo y línea citados sin necesitar reabrir el mockup.
- **SC-003** ✅ — El resumen ejecutivo + el conteo "0 bloqueantes / 27 menores / 6 cosméticos" permite concluir que la app es presentable a negocio (ningún error de marca), aunque no es una réplica 1:1 del mockup — recomendable revisar antes de un demo de diseño estricto.
- **SC-004** ✅ — Segunda pasada enfocada solo en severidad bloqueante sobre las 7 pantallas con artboard: no se encontró ningún hallazgo adicional de esa severidad.
- **FR-008** ✅ — Esta auditoría no modificó código de `apps/mobile`, `apps/web` ni `packages/ui`; solo se corrigieron `data-model.md`, `plan.md` y `tasks.md` dentro de `specs/005-mockup-consistency-audit/` (ver T016 en `tasks.md`).
