# Research: Admin Web — Dashboard y Gestión de Cartera

Todas las decisiones de esta fase resuelven el Technical Context de [plan.md](./plan.md). El esquema de datos y las fórmulas financieras ya están fijados (`spec.md` raíz, ejecutados en `specs/001-mobile-field-app/`); lo que falta decidir es cómo construir la superficie web y cómo reutilizar, sin duplicar, lo que la app móvil ya implementó.

## 1. Enrutamiento

**Decision**: React Router (`react-router-dom`), con rutas de nivel superior `/`  (dashboard), `/prestamos`, `/prestamos/:id`, `/clientes`, `/calculadora`, montadas dentro de un `AppShell` con la barra lateral fija de los mockups (1c/2e).

**Rationale**: A diferencia de la app móvil (navegación por pestañas/stack), la web es multi-URL por naturaleza — el prestamista debe poder recargar la página o compartir un enlace directo a un préstamo específico (ej. `/prestamos/1042`, como muestra la barra de direcciones del mockup 1c: `app.microcreditos.io/prestamos/1042`). React Router es el estándar de facto para Vite + React sin acoplarse a un framework full-stack que este proyecto no necesita (no hay SSR en el alcance).

**Alternatives considered**: Un enrutador basado en archivos (ej. TanStack Router, Next.js) — descartado: exigiría cambiar el bundler/entry point que ya existe (`apps/web` es Vite puro) sin aportar valor adicional a 4-5 rutas (YAGNI, constitución principio V). Un solo componente con estado local (`useState` para la "pantalla activa", sin URL real) — descartado: no soporta recargar en un préstamo específico ni enlaces directos, y los mockups asumen URLs reales.

## 2. Sistema de diseño web

**Decision**: Nuevas primitivas DOM (`packages/ui/src/primitives-web/`) expuestas vía un nuevo entry point `@repo/ui/web` (análogo a `@repo/ui/native`), consumiendo los mismos tokens (`colors`, `fontFamily`, `monetaryTextStyle`) ya exportados desde el barrel raíz de `@repo/ui`. Estilizado con TailwindCSS v4 directamente (ya instalado en `apps/web` vía `@tailwindcss/vite`), no NativeWind.

**Rationale**: `packages/ui/src/index.ts` ya deja un comentario explícito anticipando esta necesidad: *"Las primitivas de React Native están en `./native`... para que el build de `apps/web` (React DOM, sin NativeWind) nunca las type-checkee"* — es decir, la Fase 2 dejó preparado el split, pero no implementó el lado web. Los tokens (`colors.ts`, `typography.ts`) son datos puros sin JSX, ya aptos para cualquier plataforma; solo faltan los componentes. Reutilizar el mismo `@repo/ui` (en vez de un paquete nuevo) evita que la paleta/tipografía diverjan entre plataformas — riesgo real dado que ambos mockups (móvil y web) comparten paleta `#10B981`/`#1E3A8A`/`#0F172A` (`spec.md` raíz §9).

**Alternatives considered**: Estilizar `apps/web` con clases Tailwind sueltas, repitiendo los valores de color a mano en cada componente — descartado: duplica los tokens en dos lugares (`packages/ui/src/tokens` y clases hardcodeadas en `apps/web`), con riesgo de que diverjan silenciosamente en la próxima actualización de paleta. Una librería de componentes de terceros (ej. shadcn/ui, MUI) — descartado: los mockups ya definen un sistema visual propio (espaciado, radios, tipografía) que una librería genérica no reproduce sin una capa de sobreescritura tan grande como construir las primitivas propias.

## 3. Estado de servidor y caché

**Decision**: TanStack Query (`@tanstack/react-query`), igual que `apps/mobile`.

**Rationale**: Mismo argumento que `specs/001-mobile-field-app/research.md` §3 — FR-009 (equivalente web: reflejar de inmediato el estado tras un cobro) se resuelve con invalidación de caché por clave. Además, reutilizar la misma librería en ambas apps significa que los hooks de web (`useDashboardSummary`, `useActiveLoans`, `useRegisterPayment`) pueden seguir el mismo patrón ya validado en `apps/mobile/src/hooks`, sin inventar un segundo enfoque de estado remoto en el monorepo.

**Alternatives considered**: `useState`/`useEffect` manual — mismo motivo de descarte que en spec 001 (reimplementa caché/invalidación a mano). Un store global (Zustand/Redux) — descartado: no hace falta para estado remoto con invalidación por clave.

## 4. Tablas y listas

**Decision**: Tablas HTML planas (`<table>`/CSS grid, según el mockup) sin librería de virtualización ni de gestión de tablas (ej. sin TanStack Table).

**Rationale**: El alcance de la cartera sigue siendo "pequeña y manejable" (`spec.md` raíz §1, decenas a un par de cientos de clientes) — el mismo argumento de `specs/001-mobile-field-app/research.md` §5 (`FlatList` sin `FlashList`) aplica aquí: no hay problema de rendimiento que resolver todavía. Los filtros/búsqueda de las Historias 2 y 3 se resuelven filtrando en memoria sobre el resultado ya cargado (igual que `IClientReader.list(filter)` ya hace del lado del repositorio para el directorio).

**Alternatives considered**: TanStack Table — descartado por ahora (YAGNI): añade una API de column-defs/sorting/paginación para una tabla que, a esta escala, no necesita virtualización ni ordenamiento configurable por el usuario (los FR no piden sort interactivo, solo filtros/búsqueda). Se puede reconsiderar si la cartera crece mucho o si una fase posterior pide ordenamiento por columna.

## 5. Exportar a CSV (FR-007)

**Decision**: Serialización manual de CSV (sin librería) + descarga vía `Blob`/`URL.createObjectURL` y un enlace `<a download>` temporal.

**Rationale**: Generar CSV desde un array de objetos ya tipados (`ActiveLoanSummary[]`/`Client[]`) es una operación trivial (join de columnas con comas, escapar comillas) que no justifica una dependencia nueva — mismo argumento YAGNI que descartó una librería de tablas. El navegador ya soporta la descarga de archivos generados en cliente sin backend adicional.

**Alternatives considered**: Una librería como `papaparse` o `json2csv` — descartado: resuelven casos (CSV multi-línea complejo, streaming de archivos grandes) que esta feature no tiene, dado el volumen pequeño de filas.

## 6. Persistencia y backend — reutilización sin duplicar

**Decision**: Extraer `SupabaseLoanRepository`, `SupabaseClientRepository` y la creación del cliente de Supabase desde `apps/mobile/src/data/` hacia un nuevo paquete compartido `packages/data-supabase` (TypeScript puro, sin dependencias de React Native ni de React DOM). `apps/mobile` y `apps/web` importan las mismas clases; cada app solo provee sus propias credenciales (`EXPO_PUBLIC_SUPABASE_URL`/`ANON_KEY` en móvil, `VITE_SUPABASE_URL`/`ANON_KEY` en web) a una función factoría (`createSupabaseClient(url, anonKey)`) en vez de que el paquete lea `process.env` directamente.

**Rationale**: `SupabaseLoanRepository`/`SupabaseClientRepository` (`apps/mobile/src/data/`) ya son TypeScript puro — su único acoplamiento a Expo es la lectura de variables de entorno en `supabaseClient.ts`, fácil de aislar detrás de una función que recibe los valores explícitos. Duplicar estas ~450 líneas en `apps/web/src/data` arriesgaría que la guarda de concurrencia de `markInstallmentPaid` (crítica para FR-012/SC-006 de esta spec) diverja entre las dos copias si se corrige un bug en una y no en la otra — el mismo riesgo que motivó, en `specs/001-mobile-field-app/`, centralizar el motor financiero en `@repo/core` en vez de reimplementarlo por plataforma (constitución, Principio II).

**Alternatives considered**: Duplicar los archivos de `apps/mobile/src/data/` dentro de `apps/web/src/data/` — descartado por el riesgo de divergencia descrito arriba, agravado porque este código toca dinero (cobros, emisión de préstamos). Mover la lógica a una Edge Function/API propia detrás de la cual ambas apps hablen HTTP — descartado (YAGNI): Supabase ya expone el esquema vía PostgREST/RPC; añadir una capa HTTP intermedia sin un requisito que la justifique sería una segunda API a mantener sin necesidad.

## 7. Agregados de cartera para el dashboard (US1)

**Decision**: Una nueva vista SQL derivada, `cartera_resumen` (`supabase/migrations/0003_cartera_resumen.sql`), agregando `capital_prestado`, `total_recuperado`, `intereses_ganados`, `cartera_en_mora`, `cuotas_en_mora` y `clientes_en_mora` a partir de `prestamos`/`cuotas` — leída a través de una nueva interfaz `IPortfolioReader` en `@repo/core`, implementada en `packages/data-supabase`.

**Rationale**: Sigue el mismo patrón ya validado por `VIEW cliente_score` (`spec.md` raíz §4) — un agregado derivado se calcula en la base de datos en cada lectura, nunca se almacena como columna que un job deba mantener sincronizada (constitución, Principio IV). Calcular estos totales en el cliente (trayendo todos los préstamos/cuotas al navegador para sumarlos) escalaría mal y duplicaría lógica de agregación que SQL ya resuelve en una sola consulta.

**Alternatives considered**: Calcular los agregados en `apps/web` sumando el resultado de `ILoanRepository.listActive()` — descartado: obliga a traer toda la cartera al navegador solo para mostrar 4 números, y esa suma tendría que rehacerse en cualquier futura superficie que quiera el mismo dato (viola DRY, mismo motivo que llevó a `cliente_score` a ser una vista SQL y no un cálculo repetido en cada pantalla móvil).

## 8. Pruebas

**Decision**: Vitest + `@testing-library/react` para `apps/web` (en vez de Jest, que usa `apps/mobile` vía el preset `jest-expo`).

**Rationale**: `apps/web` ya usa Vite como bundler (`vite.config.ts`) — Vitest comparte su configuración y motor de transformación (esbuild/Rollup), evitando mantener una segunda configuración de Babel/Jest solo para el workspace web. `packages/core` sigue usando Jest sin cambios (ya configurado, constitución Principio III); `packages/data-supabase` (nuevo) también usa Jest para ser consistente con `packages/core`, del que depende conceptualmente.

**Alternatives considered**: Reusar Jest en `apps/web` para tener un único runner en todo el monorepo — descartado: Jest sobre Vite requiere una capa de transformación adicional (`ts-jest`/`babel-jest`) que ya es redundante con lo que Vite hace nativamente; `specs/001-mobile-field-app/` ya estableció el precedente de que cada app usa el runner idiomático de su plataforma (Jest+`jest-expo` para Expo, aquí Vitest para Vite).

## 9. Reutilización de esquema, fórmulas e interfaces existentes

**Decision**: El DDL de `clientes`/`prestamos`/`cuotas`, las funciones `emitir_prestamo`/`registrar_cobro` (`supabase/migrations/0002_procedures.sql`) y las interfaces `ILoanRepository`/`IClientReader`/`IClientWriter` ya construidas en `specs/001-mobile-field-app/` se reutilizan sin modificar su comportamiento existente — esta fase solo **añade** superficie nueva (`ILoanRepository.listActive()`, `IPortfolioReader`) donde no hay un método ya existente que sirva.

**Rationale**: `registrar_cobro` ya implementa la guarda de concurrencia a nivel de base de datos (`UPDATE ... WHERE estado = 'pendiente'`, transaccional) — satisface FR-012/SC-006 de esta spec sin ningún cambio de backend; la guarda funciona igual sin importar qué cliente (móvil o web) la invoque. Cualquier cambio de alcance o de esquema debe reflejarse primero en `spec.md` raíz, según su "Flujo de trabajo" — esta fase no lo necesita porque el modelo ya cubre lo que el dashboard/tabla de préstamos/directorio requieren, salvo los dos agregados nuevos.

**Alternatives considered**: Ninguna — no hay ambigüedad que investigar sobre el esquema base, ya verificado end-to-end en `specs/001-mobile-field-app/quickstart.md`.
