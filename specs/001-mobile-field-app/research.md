# Research: App Móvil de Cobranza en Campo

Todas las decisiones de esta fase resuelven el Technical Context de [plan.md](./plan.md). Ninguna requirió inventar diseño de producto nuevo — el esquema de datos y las fórmulas financieras ya están fijados en `spec.md` raíz; lo que faltaba era elegir cómo construir la capa de UI móvil y cómo llegar hasta esos datos.

## 1. Navegación

**Decision**: React Navigation (`native-stack` para el flujo Calculadora→Emitir y Detalle de préstamo; `bottom-tabs` para Ruta de hoy / Directorio / Calculadora como raíces).

**Rationale**: Se integra sobre el `App.tsx` existente sin reestructurar el punto de entrada del proyecto; es la opción más probada para ~7 pantallas + un modal, con soporte maduro para modales tipo hoja inferior (registro de cobro, mockup 1b).

**Alternatives considered**: Expo Router (enrutamiento por archivos) — descartado por ahora: exige mover el entry point a una carpeta `app/` y aporta poco valor extra con tan pocas pantallas (YAGNI, constitución principio V); se puede reconsiderar si el número de pantallas crece mucho en fases futuras.

## 2. Sistema de diseño / estilos

**Decision**: NativeWind, con los tokens ya definidos en `spec.md` raíz §9 (paleta `#10B981`/`#1E3A8A`/`#0F172A`, tipografías Plus Jakarta Sans + Inter) implementados como `packages/ui/src/tokens`.

**Rationale**: Ya estaba decidido en `spec.md` raíz §3 ("apps/mobile + NativeWind") y en §9 ("el sistema de diseño... se implementa en fases posteriores del roadmap de negocio") — esta es esa fase. Reutiliza la misma sintaxis Tailwind que ya usa `apps/web`, facilitando componentes compartidos en `packages/ui`.

**Alternatives considered**: `StyleSheet.create` puro (ya usado en el `App.tsx` placeholder actual) — descartado porque no escala bien a un sistema de diseño compartido entre mockups (spacing/colores consistentes en 6+ pantallas) ni se reutiliza fácilmente en `packages/ui`.

## 3. Estado de servidor y caché

**Decision**: TanStack Query (`@tanstack/react-query`) para todo dato que viene de `ILoanRepository`/`IClientReader`/`IClientWriter` (directorio, ruta de cobranza, perfil, cronograma).

**Rationale**: FR-009 exige que el saldo/estado se refleje "de inmediato... en todas las pantallas donde ese cliente o préstamo sean visibles" tras un cobro — TanStack Query resuelve esto con invalidación de caché por clave (ej. invalidar `['client', id]` y `['collectionRoute']` al confirmar un cobro) sin construir un store global a mano.

**Alternatives considered**: `useState`/`useEffect` manual — descartado: reimplementaría caché/invalidación/estados de carga a mano para cada pantalla, violando YAGNI en la dirección contraria (más código, no menos). Un store global tipo Zustand/Redux — descartado: esos resuelven estado de UI local, no estado remoto con invalidación; no hace falta un store global para esta feature.

## 4. Detección de conexión (FR-013)

**Decision**: `@react-native-community/netinfo`.

**Rationale**: Es la librería estándar compatible con Expo para conocer el estado de red antes de intentar una acción; permite mostrar el aviso de FR-013 de forma proactiva (antes de tocar "Emitir"/"Confirmar cobro"), no solo reactiva ante un error de red.

**Alternatives considered**: Detectar solo por el fallo/timeout de la petición — descartado: no cumple el requisito de FR-013 de avisar claramente antes de intentar la operación; peor UX en campo, donde la señal intermitente es el caso común, no la excepción.

## 5. Listas (directorio, ruta de cobranza, cronograma)

**Decision**: `FlatList` nativo de React Native.

**Rationale**: El alcance de la cartera es "pequeña y manejable" (decenas a un par de cientos de clientes, `spec.md` raíz §1); `FlatList` virtualiza de sobra a esa escala sin dependencias adicionales.

**Alternatives considered**: `FlashList` (Shopify) — descartado por ahora (YAGNI): resuelve un problema de rendimiento a mayor escala que no existe todavía; se puede migrar después si la cartera crece mucho.

## 6. Persistencia y backend

**Decision**: `@supabase/supabase-js` como implementación concreta de `ILoanRepository`/`IClientReader`/`IClientWriter` (vía DIP, constitución principio I), contra el esquema ya definido en `spec.md` raíz §4 (tablas `clientes`/`prestamos`/`cuotas` + `VIEW cliente_score`). Desarrollo local: stack de Supabase levantado con Docker (Postgres en el puerto 5432 fijado por la constitución); producción: proyecto Supabase hosteado.

**Rationale**: Es la única opción coherente con la constitución ("DIP — apps/* dependen de interfaces, nunca de un cliente concreto de Supabase" + "Base de datos: PostgreSQL (Supabase en producción; contenedor Docker local... para desarrollo)"). Además resuelve por qué el móvil no puede hablar Postgres directo: Supabase expone el esquema como REST (PostgREST) sobre HTTPS, apto para un cliente móvil, sin exponer credenciales de base de datos en el dispositivo.

**Alternatives considered**: Backend propio (API REST/GraphQL a medida) — descartado: sería una segunda capa a diseñar y mantener sin necesidad, cuando Supabase ya genera la API sobre el esquema existente (YAGNI). SQLite local únicamente — descartado: rompería el requisito implícito de que la cartera se comparta entre el móvil (campo) y el futuro Admin Web (oficina); ver `spec.md` raíz §1, "ambas [superficies] se apoyan en el mismo motor financiero" sobre los mismos datos.

## 7. Pruebas

**Decision**: Jest + `@testing-library/react-native` para pantallas/hooks de `apps/mobile`; Jest ya obligatorio por la constitución para `packages/core`.

**Rationale**: Mismo runner en todo el monorepo (menos configuración duplicada); `@testing-library/react-native` es el estándar de facto para probar interacción de usuario en RN sin acoplarse a detalles internos de implementación.

**Alternatives considered**: Detox (e2e real en dispositivo/simulador) — fuera de alcance de este plan; puede añadirse después para flujos críticos (US1/US2) si la cobertura de integración con Testing Library resulta insuficiente.

## 8. Reutilización de esquema y fórmulas

**Decision**: El DDL de `clientes`/`prestamos`/`cuotas` + `VIEW cliente_score` (spec.md raíz §4) y las fórmulas de amortización (§5.1, con la regla de redondeo §5.3) se implementan tal cual, sin modificar ni un campo ni una fórmula.

**Rationale**: Ya fueron diseñados y verificados a mano (caso $500/15%/12→$47.92) en `spec.md` raíz; esta fase es de ejecución, no de (re)diseño — cualquier cambio de alcance o de modelo de datos debe reflejarse primero ahí, según el "Flujo de trabajo" de la constitución.

**Alternatives considered**: Ninguna — no hay ambigüedad que investigar aquí.
