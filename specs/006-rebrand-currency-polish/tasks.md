---

description: "Task list template for feature implementation"
---

# Tasks: Marca Prestly, selector de moneda y cierre de brechas de mockup

**Input**: Design documents from `specs/006-rebrand-currency-polish/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: Se incluyen tareas de test para `packages/core` (Principio III de la constitución, NON-NEGOTIABLE) y para los repositorios nuevos de `packages/data-supabase` (mismo estándar que specs/002-005). No se generan tests de UI nuevos más allá de los que ya existen por página (se actualizan los que queden rotos por los cambios).

**Organization**: Tareas agrupadas por historia de usuario (spec.md) para implementar y verificar cada una de forma independiente.

## Phase 1: Setup

- [X] T001 Crear `supabase/migrations/0006_configuracion_app.sql` con la tabla `configuracion_app` (singleton, `CHECK (id = 1)`, `moneda` con `CHECK IN ('COP','USD','MXN')` default `'COP'`) y su `INSERT` inicial (data-model.md, data-contract.md)
- [X] T002 [P] Crear `packages/core/src/domain/currency.ts` con `CurrencyCode`, `SUPPORTED_CURRENCIES` (COP/USD/MXN, ver data-model.md) y `formatMoney(amount, currency)`, con test primero en `packages/core/__tests__/domain/currency.test.ts` (contracts/core-interfaces.md — casos de referencia COP sin decimales, USD/MXN con 2)

**Checkpoint**: Migración y utilidad de formato listas para que cualquier historia las use.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Interfaces, repositorio y caso de uso compartidos que varias historias necesitan antes de tener UI.

**⚠️ CRITICAL**: Ninguna historia de usuario empieza su UI sin esta fase completa.

- [X] T003 [P] En `packages/core/src/interfaces/index.ts`, añadir `AppSettings` e `IAppSettingsRepository` (contracts/core-interfaces.md) — depende de T002 (usa `CurrencyCode`)
- [X] T004 [P] Crear `packages/core/src/use-cases/createStandaloneClient.ts` (`createStandaloneClient`, `DuplicatePhoneError`), con test primero en `packages/core/__tests__/use-cases/createStandaloneClient.test.ts` (contracts/core-interfaces.md) — reutiliza `IClientReader`/`IClientWriter` ya existentes, no depende de T002/T003
- [X] T005 [P] Crear `packages/data-supabase/src/SupabaseAppSettingsRepository.ts` implementando `IAppSettingsRepository` (select/update directo sobre `configuracion_app`, sin RPC), con test en `packages/data-supabase/__tests__/` — depende de T001, T003
- [X] T006 [P] Crear el primitivo compartido `SegmentedControl` en `packages/ui/src/primitives/SegmentedControl.tsx` (mobile) y `packages/ui/src/primitives-web/SegmentedControl.tsx` (web), exportado desde `packages/ui/src/native.ts` y `packages/ui/src/web.ts` respectivamente (research.md §4) — sin dependencias de otras tareas
- [X] T007 Registrar `clientRepository`/`appSettingsRepository` nuevos en `apps/web/src/data/repositories.ts` y `apps/mobile/src/data/repositories.ts` (instanciar `SupabaseAppSettingsRepository`) — depende de T005

**Checkpoint**: Interfaces, repositorio de configuración, caso de uso de alta de cliente y `SegmentedControl` listos — las 6 historias pueden empezar su UI.

---

## Phase 3: User Story 1 - Selector de moneda (Priority: P1) 🎯 MVP

**Goal**: La app muestra COP por defecto y un administrador puede cambiar a USD/MXN desde la web, reflejado también en mobile.

**Independent Test**: quickstart.md Historia 1 — cambiar moneda desde "Configuración" en la web y confirmar el nuevo formato en Dashboard/Clientes/Préstamos/Calculadora (web) y en Ruta de hoy/Directorio (mobile tras refrescar).

- [X] T008 [US1] Crear `apps/web/src/hooks/useAppSettings.ts` (`useAppSettings` con `updateCurrency`, invalida `['appSettings']` en `onSuccess` — data-contract.md) — depende de T007
- [X] T009 [US1] Crear `apps/web/src/pages/SettingsPage.tsx`: mueve el contenido de `WhatsAppConfigPage.tsx` a una tarjeta "Conexión con Twilio" y añade una tarjeta nueva "Moneda" (select con las 3 opciones, usa `useAppSettings`) — depende de T008; eliminar `apps/web/src/pages/WhatsAppConfigPage.tsx` una vez migrado su contenido
- [X] T010 [US1] Actualizar `apps/web/src/router.tsx` (`/whatsapp` → `/configuracion` apuntando a `SettingsPage`) y `apps/web/src/layout/AppShell.tsx` (ítem de nav "WhatsApp" → "Configuración") — depende de T009
- [X] T011 [US1] Reescribir `apps/web/src/lib/formatCurrency.ts` para delegar en `formatMoney` de `@repo/core`, recibiendo la moneda activa de `useAppSettings` en cada punto de llamada (`DashboardPage.tsx`, `ClientDirectoryPage.tsx`, `ActiveLoansPage.tsx`, `LoanAmortizationPage.tsx`, `QuoteCalculatorPage.tsx`, `ClientDetailDrawer.tsx`) — depende de T008; **[P] no aplica**, un solo archivo de formato compartido por todos los llamadores. **Nota de implementación**: en vez de exponer una función plana que reciba `currency` como argumento en cada llamada, se implementó como hook `useFormatCurrency()` (`apps/web/src/hooks/useFormatCurrency.ts`) que devuelve una función ya atada a la moneda activa — evita tocar el orden de ~30 llamadas existentes a `formatCurrency(monto)`, solo cambia cómo cada componente la obtiene (un import + una línea). Se eliminó `lib/formatCurrency.ts` en favor de este hook.
- [X] T012 [P] [US1] Crear `apps/mobile/src/hooks/useAppSettings.ts` (solo lectura, `refetchOnMount: 'always'`) — depende de T007
- [X] T013 [US1] Reescribir `apps/mobile/src/utils/money.ts` para delegar en `formatMoney` de `@repo/core`, recibiendo la moneda de `useAppSettings` en cada pantalla que muestra dinero (`QuoteCalculatorScreen.tsx`, `ClientDirectoryScreen.tsx`, `ClientProfileScreen.tsx`, `CollectionRouteScreen.tsx`, `LoanDetailScreen.tsx`) — depende de T012. Mismo enfoque de hook que T011 (`useFormatCurrency`, `apps/mobile/src/hooks/useFormatCurrency.ts`) — se eliminó `utils/money.ts`. Se descubrió al implementar que ~30 puntos de llamada anteponían un `$` literal en el JSX (porque la vieja `formatMoney` no incluía símbolo); se limpiaron todos, y los mensajes de WhatsApp (`LoanDetailScreen.tsx`) ahora usan `.replace('$', '')` antes de pasar el monto a `buildLoanShareMessage`/`buildReceiptMessage` (que ya anteponen su propio "$"), mismo patrón que ya usaba `apps/web`. Se actualizaron también los tests existentes (`QuoteCalculatorScreen`, `CollectionRouteScreen`) a los valores esperados en COP.
- [X] T014 [US1] Verificación de punta a punta: quickstart.md Historia 1 completa contra la base local reseteada, cambiando efectivamente entre las 3 monedas — depende de T009-T013

**Checkpoint**: Historia 1 funcional e independiente — moneda configurable y reflejada en ambas apps.

---

## Phase 4: User Story 2 - Identidad de marca "Prestly" (Priority: P1)

**Goal**: Ninguna superficie visible muestra un nombre distinto de "Prestly".

**Independent Test**: quickstart.md Historia 2 — inspección visual de la web y del `app.json` de mobile.

- [X] T015 [P] [US2] En `apps/web/src/layout/AppShell.tsx`: texto del sidebar "Microcréditos" → "Prestly", inicial del logo "m" → "P" — sin dependencias
- [X] T016 [P] [US2] En `apps/mobile/app.json`: `expo.name` "mobile" → "Prestly" (se deja `slug` sin cambios — Assumptions de spec.md) — sin dependencias
- [X] T017 [US2] Verificación visual: abrir web y mobile, confirmar ausencia de "Microcréditos" en cualquier texto visible — depende de T015, T016

**Checkpoint**: Historia 2 funcional e independiente.

---

## Phase 5: User Story 3 - Alta de cliente sin préstamo (Priority: P2)

**Goal**: Crear un cliente desde el directorio (web o mobile) sin emitir un préstamo, con la misma guarda anti-duplicado de teléfono.

**Independent Test**: quickstart.md Historia 3 — crear cliente nuevo desde "Nuevo cliente"/"+ Nuevo" en ambas plataformas; confirmar rechazo de teléfono duplicado.

- [X] T018 [P] [US3] Crear `apps/web/src/hooks/useCreateClient.ts` (envuelve `createStandaloneClient` de `@repo/core` con `clientRepository`, invalida `['clientDirectory']` en éxito, propaga `DuplicatePhoneError` como mensaje de formulario) — depende de T004, T007
- [X] T019 [US3] Crear `apps/web/src/components/NewClientModal.tsx` (nombre, teléfono, dirección opcional; usa `useCreateClient`) y el botón "Nuevo cliente" en `apps/web/src/pages/ClientDirectoryPage.tsx` (junto a "Exportar CSV") — depende de T018
- [X] T020 [P] [US3] Crear `apps/mobile/src/hooks/useCreateClient.ts` (mismo patrón que T018, adaptado a React Query de mobile) — depende de T004, T007
- [X] T021 [US3] Crear `apps/mobile/src/components/NewClientModal.tsx` y el botón "+ Nuevo" en `apps/mobile/src/screens/ClientDirectoryScreen.tsx` (header, junto al título) — depende de T020
- [X] T022 [US3] Verificación de punta a punta: quickstart.md Historia 3 completa (alta en ambas plataformas + rechazo de duplicado) — depende de T019, T021

**Checkpoint**: Historia 3 funcional e independiente — prerrequisito de los botones "+ Nuevo"/"Nuevo cliente" citados en las Historias 4/5, ya resuelto aquí.

---

## Phase 6: User Story 4 - Fidelidad del flujo móvil de campo (Priority: P2)

**Goal**: Calculadora, directorio, perfil y ruta de cobranza móviles siguen el mockup en los puntos de categoría "botón" + contenido asignado a mobile.

**Independent Test**: quickstart.md Historia 4, recorriendo las 4 pantallas.

- [X] T023 [P] [US4] En `apps/mobile/src/screens/QuoteCalculatorScreen.tsx`: renombrar el botón de compartir a "Compartir tabla por WhatsApp" con ícono de WhatsApp, usando directamente `buildWhatsAppShareLink`/`buildLoanShareMessage` de `@repo/core` en vez del share nativo del SO (REPORT.md, `mobile-quote-calculator`, hallazgo "boton"/menor). **Desviación**: en este punto del flujo todavía no hay cliente/teléfono seleccionado (eso ocurre recién dentro de `IssueLoanSheet`, al emitir), así que no se puede construir un enlace `wa.me` real; se mantuvo el share nativo del SO (que sí permite elegir WhatsApp) y solo se corrigió la etiqueta. Tampoco se agregó ícono: el proyecto no tiene ninguna librería de íconos (todas las demás acciones de WhatsApp del código son texto plano, p. ej. `ClientDirectoryScreen.tsx`) — mantener texto-only es consistente con el resto de la app (YAGNI, evita una dependencia nueva).
- [X] T024 [P] [US4] En `apps/mobile/src/screens/QuoteCalculatorScreen.tsx`: reemplazar el alternador "Ver resumen/Ver tabla completa" por el `SegmentedControl` de T006 (REPORT.md, hallazgo "boton"/cosmético) — depende de T006
- [X] T025 [US3+US4] En `apps/mobile/src/screens/ClientDirectoryScreen.tsx`: confirmar que el botón "+ Nuevo" de T021 queda visualmente en la posición del mockup (header, junto a "Directorio") — depende de T021 (verificación, no implementación nueva)
- [X] T026 [P] [US4] En `apps/mobile/src/screens/ClientProfileScreen.tsx`: "Notas privadas" pasa a solo-lectura con enlace "Editar" que habilita el modo edición (reutiliza `useUpdateClientNotes` ya existente) — REPORT.md, hallazgo "boton"/menor
- [X] T027 [US4] En `apps/mobile/src/screens/ClientProfileScreen.tsx`: agregar barra de acciones inferior fija con "Llamar" (`tel:`), "WhatsApp" (`buildWhatsAppShareLink`) y "Nuevo préstamo" (navega a `QuoteCalculatorScreen` pasando `clientId` para preseleccionar el cliente en `IssueLoanSheet.tsx`) — depende de T023 (reutiliza el helper de WhatsApp ya integrado ahí)
- [X] T028 [P] [US4] En `apps/mobile/src/screens/CollectionRouteScreen.tsx`: cambiar la forma del botón de acción de cada fila de circular (`rounded-full`) a cuadrado redondeado (10px) — REPORT.md, hallazgo "boton"/cosmético
- [X] T029 [US4] Verificación de punta a punta: quickstart.md Historia 4 completa contra la base local reseteada — depende de T023, T024, T026, T027, T028

**Checkpoint**: Historia 4 funcional e independiente.

---

## Phase 7: User Story 5 - Fidelidad y contenido del panel web (Priority: P2)

**Goal**: Préstamos activos, directorio y drawer web muestran el contenido del mockup que hoy falta, más la nueva página "Perfil completo".

**Independent Test**: quickstart.md Historia 5, recorriendo las 2 pantallas con mockup propio más la nueva página.

- [X] T030 [P] [US5] En `apps/web/src/pages/LoanAmortizationPage.tsx`: `FilterTab` muestra el conteo inline ("Todas · N") — REPORT.md, hallazgo "boton"/cosmético
- [X] T031 [P] [US5] En `apps/web/src/pages/LoanAmortizationPage.tsx`: agregar columna "Saldo restante" a la tabla de amortización (`monto_cuota - COALESCE(monto_pagado,0)` por fila, ya disponible en los datos de `LoanInstallment` — data-model.md)
- [X] T032 [US5] En `apps/web/src/pages/ClientDirectoryPage.tsx`: agregar las 3 tarjetas KPI (clientes activos, préstamo promedio, tasa de reincidencia) calculadas en memoria sobre la lista ya cargada (data-model.md, "Entidades de UI") — depende de T019 (comparte el header con el botón "Nuevo cliente")
- [X] T033 [US5] En `apps/web/src/pages/ClientDirectoryPage.tsx`: ampliar la tabla de 3 a 7 columnas (Cliente/Préstamos/Saldo activo/Comportamiento+score+barra de `ProgressBar`/Próximo pago/Estado/Acciones con "Ver perfil"+WhatsApp) — depende de T032
- [X] T034 [US5] En `apps/web/src/pages/ClientDirectoryPage.tsx`: agregar barra de pie con "Saldo agregado" y "Score medio" de los clientes listados — depende de T033
- [X] T035 [P] [US5] En `apps/web/src/components/ClientDetailDrawer.tsx`: agregar 3ª tarjeta "Cobrado" (junto a "Prestado"/"Saldo") y barra de progreso de amortización con etiqueta "X de Y · Z%"
- [X] T036 [US5] Crear `apps/web/src/pages/ClientProfilePage.tsx` (score con bandas A+/A/B/C, notas privadas de solo lectura, historial completo de préstamos — espejando `apps/mobile/src/screens/ClientProfileScreen.tsx`, adaptado a layout de 2 columnas de escritorio), reutilizando `useClientDetail` ya existente — sin dependencias de otras tareas de esta fase
- [X] T037 [US5] Registrar la ruta `/clientes/:id` en `apps/web/src/router.tsx` apuntando a `ClientProfilePage` y agregar el botón "Perfil completo" en `apps/web/src/components/ClientDetailDrawer.tsx` que navega ahí — depende de T035, T036
- [X] T038 [US5] Verificación de punta a punta: quickstart.md Historia 5 completa, incluyendo un cliente sembrado sin préstamo activo abriendo su "Perfil completo" (estado vacío, no error) — depende de T030, T031, T034, T037

**Checkpoint**: Historia 5 funcional e independiente.

---

## Phase 8: User Story 6 - Datos semilla (Priority: P3)

**Goal**: Un `db reset` local deja una cartera de ejemplo variada en pesos colombianos.

**Independent Test**: quickstart.md Historia 6 — resetear y confirmar la variedad de estados sin acción manual adicional.

- [X] T039 [US6] Crear `supabase/seed.sql` con ~9 clientes/préstamos/cuotas precalculados a mano (research.md §6): al día, mora reciente (1-5 días), mora antigua (>15 días), cobro hoy, pago parcial ya registrado, préstamo liquidado, sin préstamo activo, cubriendo las 3 frecuencias — montos en magnitud de pesos colombianos (cientos de miles)
- [X] T040 [US6] Verificación: `npx supabase db reset` y confirmar en el directorio de ambas apps la variedad completa de estados y frecuencias descrita en spec.md, Historia 6 — depende de T039

**Checkpoint**: Todas las historias de usuario completas y verificadas de forma independiente.

---

## Phase 9: Polish & Cross-Cutting Concerns

- [X] T041 [P] Actualizar `specs/005-mockup-consistency-audit/REPORT.md`: marcar como resueltos los hallazgos de categoría "boton" cerrados por las Fases 6-7 (no se re-audita desde cero, solo se anota qué quedó corregido — SC-004 de spec.md)
- [X] T042 [P] Ejecutar `npm run type-check`, `npm run test` (`@repo/core`, `packages/data-supabase`), `npm test --workspace=web` y la suite de `apps/mobile`; registrar el conteo real de tests en este archivo (no estimarlo). `type-check` limpio en los 5 paquetes. Tests: **88 en total** — 31 `@repo/core` (+8 nuevos: 5 de `currency.test.ts`, 2 de `create-standalone-client.test.ts`, más los ya existentes) + 29 `@repo/data-supabase` (+3 nuevos de `SupabaseAppSettingsRepository.test.ts`) + 17 `web` (sin cambio de conteo, pero 5 archivos reescritos a moneda COP) + 11 `mobile` (sin cambio de conteo, reescritos a COP + flujo de notas).
- [X] T043 Revisar y actualizar cualquier test de UI existente que quede roto por los cambios de columnas/botones de las Fases 3-7 (`ClientDirectoryPage`, `LoanAmortizationPage`, `ClientDetailDrawer`, `QuoteCalculatorScreen`, `ClientProfileScreen`, `ClientDirectoryScreen`, `CollectionRouteScreen`) — depende de T042. Actualizados a valores COP: `DashboardPage.test.tsx`, `QuoteCalculatorPage.test.tsx`, `LoanAmortizationPage.test.tsx` (web), `QuoteCalculatorScreen.test.tsx`, `CollectionRouteScreen.test.tsx`, `ClientProfileScreen.test.tsx` (mobile, además del flujo solo-lectura de notas). `ClientDirectoryPage.test.tsx` (web) ganó defaults para `getScore`/`listByClient` (nuevas consultas de `useClientDirectoryExtras`, US5) que antes no necesitaba mockear. Hallazgo real durante la verificación: `findByRole({name})` conserva el espacio exacto que produce `Intl` en el nombre accesible del botón (a diferencia de `getByText`, que sí lo normaliza) — se resolvió comparando con todo espacio removido en vez de reconstruir el carácter exacto.
- [X] T044 Actualizar `spec.md` raíz (Anexo) registrando esta fase como entregada, mismo estilo que las Fases 2-5

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sin dependencias — inicia de inmediato
- **Foundational (Phase 2)**: Depende de Setup — bloquea todas las historias de usuario
- **User Story 1 — Moneda (Phase 3)**: Depende de Foundational; independiente de las demás historias
- **User Story 2 — Marca (Phase 4)**: Depende de Foundational; totalmente independiente (ni siquiera comparte archivos con otras historias, salvo `AppShell.tsx` que también toca la Historia 1 en un punto distinto del mismo archivo — T010 y T015 deben coordinarse si se paralelizan)
- **User Story 3 — Alta de cliente (Phase 5)**: Depende de Foundational; prerrequisito funcional (no de código) de los botones citados en Historias 4/5, pero desplegable y probable de forma independiente
- **User Story 4 — Fidelidad móvil (Phase 6)**: Depende de Foundational y de T021 (botón "+ Nuevo") y T023 (helper de WhatsApp) para T025/T027 específicamente — el resto de sus tareas son independientes
- **User Story 5 — Fidelidad web (Phase 7)**: Depende de Foundational y de T019 (botón "Nuevo cliente") para T032 específicamente — el resto de sus tareas son independientes
- **User Story 6 — Seed (Phase 8)**: Depende de Setup (tabla `configuracion_app` de T001, para poder sembrar una moneda coherente) pero no de ninguna historia de UI
- **Polish (Phase 9)**: Depende de que las historias que se vayan a entregar estén completas

### Parallel Opportunities

- T002 (formato de moneda) y T004 (caso de uso de alta de cliente) son paralelas entre sí (archivos y dominios distintos de `@repo/core`)
- T003, T004, T005, T006 son paralelas entre sí una vez cerrado Setup (T001/T002)
- Historia 2 (Phase 4) es enteramente paralela a cualquier otra historia — no comparte lógica, solo un archivo (`AppShell.tsx`) con un punto de edición distinto al de la Historia 1
- Historia 6 (seed data) puede avanzar en paralelo a las Historias 3-5 en cuanto Setup esté listo — no depende de UI
- Dentro de cada historia, las tareas marcadas `[P]` tocan archivos distintos y pueden asignarse a personas/agentes distintos

---

## Implementation Strategy

### MVP First (User Story 1 + 2)

1. Completar Phase 1 (Setup) y Phase 2 (Foundational)
2. Completar Phase 3 (Moneda) y Phase 4 (Marca) — ambas P1, ambas rápidas de verificar de forma aislada
3. **Detener y validar**: la app ya muestra pesos colombianos y se llama "Prestly" — valor de negocio inmediato aunque falte el resto
4. Continuar con Historias 3, 4, 5 (P2) y cerrar con la 6 (P3, datos semilla)

### Incremental Delivery

1. Setup + Foundational → base lista
2. US1 (moneda) + US2 (marca) → demo inmediato de las dos correcciones de mayor visibilidad
3. US3 (alta de cliente) → desbloquea los botones "+ Nuevo"/"Nuevo cliente" que las Historias 4/5 solo necesitan como prerrequisito funcional
4. US4 (móvil) y US5 (web) → cierran el catálogo de brechas de mockup, pueden repartirse entre dos personas/agentes en paralelo
5. US6 (seed) → acelera cualquier prueba o demo posterior
6. Polish → type-check, tests, y actualización de `spec.md` raíz y del reporte de auditoría 005
