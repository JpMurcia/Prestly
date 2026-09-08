# Research: Marca Prestly, selector de moneda y cierre de brechas de mockup

## 1. Dónde vive la configuración de moneda

**Decision**: Tabla `configuracion_app` en `public`, fila única (`id` fijo, `CHECK (id = 1)` para impedir una segunda fila), columna `moneda TEXT NOT NULL DEFAULT 'COP' CHECK (moneda IN ('COP','USD','MXN'))`. Sin Vault, sin RLS, sin funciones RPC — acceso directo por `supabase-js` (`select`/`update`), igual que `clientes`/`prestamos`/`cuotas`.

**Rationale**: La moneda no es un secreto (a diferencia de las credenciales de Twilio), así que el patrón de `SupabaseWhatsAppConfigRepository` (Vault + `SECURITY DEFINER`) sería complejidad no justificada. El proyecto ya tiene un patrón para "una fila de configuración leída/actualizada directamente": ninguna tabla del proyecto usa RLS hoy (confirmado — `grep` sobre `supabase/migrations/*.sql` no encuentra ninguna política), así que una tabla plana es consistente con el resto del esquema.

**Alternatives considered**:
- Reutilizar Vault (como WhatsApp) — rechazado: over-engineering para un dato no sensible, y forzaría pasar por funciones `SECURITY DEFINER` sin necesidad.
- Guardar la moneda como fila en una tabla `configuracion` genérica clave-valor (`clave TEXT, valor TEXT`) para "futuros ajustes" — rechazado por YAGNI (Principio V): hoy solo existe un ajuste (moneda); se generaliza si aparece un segundo.
- `localStorage`/config solo en el cliente — rechazado: no cumpliría FR-003 (un cambio hecho en web debe reflejarse en mobile).

## 2. Dónde vive el formato de moneda (`formatMoney`)

**Decision**: Nueva función pura `formatMoney(amount: number, currency: CurrencyCode): string` en `packages/core/src/domain/currency.ts`, junto a una tabla de metadata:

| Código | Símbolo | Locale  | Decimales |
|--------|---------|---------|-----------|
| `COP`  | `$`     | `es-CO` | 0         |
| `USD`  | `$`     | `en-US` | 2         |
| `MXN`  | `$`     | `es-MX` | 2         |

Implementada sobre `Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits, maximumFractionDigits })`.

**Rationale**: `apps/web/src/lib/formatCurrency.ts` y `apps/mobile/src/utils/money.ts` ya son casi idénticas (ambas fuerzan `en-US` + 2 decimales) — es la duplicación que el Principio II ("Motor financiero único") existe para evitar, aunque el formato de moneda no sea en sí un cálculo financiero. Centralizarlo en `@repo/core` es la corrección natural al tocar este código, no una refactorización fuera de alcance. 0 decimales para COP es la convención real de uso en Colombia (evita mostrar "$41,670" como "$41.670,00" cuando nadie maneja centavos de peso en microcréditos).

**Alternatives considered**:
- Dejar `formatCurrency.ts`/`money.ts` como están y solo cambiarles el símbolo — rechazado: perpetuaría la duplicación y no permitiría que ambas apps reaccionen igual a un cambio de moneda.
- Librería de formato de moneda (`dinero.js`, etc.) — rechazada: `Intl.NumberFormat` nativo ya cubre el caso sin dependencia nueva (YAGNI).

## 3. Alta de cliente sin préstamo — reutilización de la guarda anti-duplicado

**Decision**: Nuevo caso de uso puro `createStandaloneClient(input: NewClient, deps: { clientReader: IClientReader; clientWriter: IClientWriter }): Promise<Client>` en `packages/core/src/use-cases/createStandaloneClient.ts`. A diferencia de `resolveClientId` (interno de `issueLoan.ts`, que **reutiliza** silenciosamente un cliente existente con el mismo teléfono), esta función **rechaza** la creación lanzando `DuplicatePhoneError` si `clientReader.findByPhone` encuentra coincidencia — la semántica correcta para un alta explícita e independiente (spec FR-007: "impedir crear un cliente con un teléfono que ya pertenece a otro").

**Rationale**: `IClientReader.findByPhone` e `IClientWriter.create` ya existen y ya se usan con este propósito exacto dentro de `issueLoan.ts` — no se necesita ninguna función ni columna nueva en la capa de datos, solo una composición distinta en `@repo/core` (mismo espíritu del Principio I/OCP: se agrega código nuevo, no se modifica `issueLoan.ts` existente).

**Alternatives considered**:
- Simplemente llamar `clientRepository.create()` directo desde cada hook de UI sin pasar por un caso de uso de `@repo/core` — rechazado: duplicaría la validación anti-duplicado en 2 hooks (web/mobile) en vez de una vez en el motor compartido (Principio II).
- Hacer que el nuevo flujo reutilice `resolveClientId` de `issueLoan.ts` tal cual — rechazado: esa función reutiliza silenciosamente al cliente existente (correcto para emitir un préstamo, donde no importa si el cliente ya existía), pero el spec de esta historia exige *rechazar* explícitamente el duplicado, una semántica distinta que merece su propia función.

## 4. Toggle "Ver resumen/Ver tabla completa" como control segmentado

**Decision**: Nuevo primitivo compartido `SegmentedControl` en `packages/ui/src/primitives/` (mobile) y `primitives-web/` (web, aunque esta pantalla específica del mockup solo existe en mobile — se agrega también a `primitives-web` por si `apps/web` lo necesita a futuro, sin agregarle un segundo consumidor artificial ahora).

**Rationale**: El mockup pide un control de dos pestañas con la activa elevada (fondo blanco) — no es una variante de `Chip` (que es para selección múltiple de filtros) ni de `Button` — merece su propio primitivo pequeño y reutilizable, siguiendo el mismo patrón ya establecido de primitivos compartidos (`Card`, `Badge`, `ProgressBar`, `Chip`).

**Alternatives considered**:
- Implementarlo ad-hoc solo dentro de `QuoteCalculatorScreen.tsx` sin extraerlo — rechazado: el propio reporte de auditoría (005) ya señaló como causa raíz de varias inconsistencias el hecho de construir controles ad-hoc en vez de primitivos compartidos ("Nota de consistencia", REPORT.md).

## 5. Página web "Perfil completo" sin artboard propio

**Decision**: Nueva página `apps/web/src/pages/ClientProfilePage.tsx` en la ruta `/clientes/:id`, reutilizando el hook ya existente `useClientDetail` (trae `findById` + `getScore`, ya usado por `ClientDetailDrawer`). El contenido espeja la información de `apps/mobile/src/screens/ClientProfileScreen.tsx` (score con bandas A+/A/B/C, notas privadas, historial de préstamos) adaptada a un layout de página completa de escritorio (dos columnas: info + historial) en vez de una pantalla móvil de una columna.

**Rationale**: Ningún artboard del mockup dibuja esta pantalla para web (confirmado en `specs/005-mockup-consistency-audit/REPORT.md`, tabla "Pantallas sin mockup de referencia") — la única referencia de contenido disponible es la contraparte móvil (artboard `2c`), así que se usa como fuente de verdad de qué información mostrar, no de layout pixel a pixel.

**Alternatives considered**:
- No construir la página y dejar el botón "Perfil completo" fuera de alcance — rechazado explícitamente por el usuario al elegir el alcance "completo" en el brainstorming previo a este spec.
- Reutilizar el mismo `ClientDetailDrawer` ampliado en vez de una página nueva — rechazado: el mockup y el spec piden explícitamente una navegación a una página dedicada ("Perfil completo" como acción distinta de "Registrar cobro" dentro del drawer), no una variante más grande del mismo panel lateral.

## 6. Datos semilla (`supabase/seed.sql`)

**Decision**: Archivo con `INSERT` literales (sin generación aleatoria) para ~9 clientes con sus préstamos y cuotas ya precalculados a mano con la fórmula de interés simple de `spec.md` raíz §5.1 (capital/cuotas, interés total = capital × tasa, última cuota absorbe el residuo de redondeo), en montos realistas para pesos colombianos (cientos de miles, no unidades). Cubre: al día, mora reciente (1-5 días), mora antigua (>15 días), cobro hoy, pago parcial ya registrado sobre una cuota, préstamo liquidado (`estado='liquidado'`), cliente sin ningún préstamo, y las 3 frecuencias de pago.

**Rationale**: Con ~9 filas fijas, precalcular a mano es más simple y depurable que escribir un generador — y determinístico (los mismos datos en cada reseteo, para que capturas de pantalla y demos sean reproducibles). `config.toml` ya declara `sql_paths = ["./seed.sql"]`; el archivo solo faltaba crearse.

**Alternatives considered**:
- Un script Node/TS que genere e inserte datos vía `supabase-js` — rechazado: el proyecto no tiene un runner de scripts de seed hoy, y `supabase/seed.sql` ya es el mecanismo declarado en `config.toml` (correr automáticamente en `db reset`); usarlo es más simple que introducir uno nuevo (YAGNI).
- Datos aleatorios en cada reseteo — rechazado: dificulta reproducir un hallazgo o una captura de pantalla específica.
