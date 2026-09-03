# Prestly Constitution

## Core Principles

### I. SOLID estricto en @repo/core (NON-NEGOTIABLE)
`@repo/core` es TypeScript puro: sin React, sin React Native, sin cliente de Supabase. SRP — `AmortizationCalculator` solo calcula, nunca persiste ni renderiza. OCP — nuevas estrategias de interés (`IInterestStrategy`) se añaden como clases nuevas, nunca modificando una estrategia existente. LSP — cualquier frecuencia de pago (semanal/quincenal/mensual) es intercambiable sin errores matemáticos. ISP — lectura y escritura de una misma entidad se separan en interfaces distintas (`IClientReader` / `IClientWriter`). DIP — `apps/*` dependen de interfaces (`ILoanRepository`), nunca de un cliente concreto de Supabase.

### II. Motor financiero único
Toda la lógica de cálculo de intereses y amortización vive exclusivamente en `@repo/core`. `apps/web` y `apps/mobile` la consumen, nunca la reimplementan. Si un cálculo financiero necesita cambiar, cambia en un solo lugar y ambas apps lo heredan igual.

### III. Test-First para el motor financiero (NON-NEGOTIABLE)
Ningún cambio en `packages/core` se acepta sin un test Jest que lo cubra primero. El caso de prueba de referencia ($500, 15%, 12 cuotas semanales → cuota $47.92, interés total $75.00) no puede dejar de pasar.

### IV. Estado derivado sobre estado almacenado
Mora, score de confianza y saldo se calculan a partir de datos inmutables (fechas de vencimiento, cuotas pagadas) — nunca se guardan como columnas que un job deba mantener sincronizadas. Si un valor puede derivarse sin ambigüedad, no se almacena.

### V. Simplicidad (YAGNI)
No se construye para las fases futuras del roadmap de negocio (WhatsApp, multi-tenant, pagos parciales, auth) hasta que esa fase llegue. Las interfaces quedan abiertas para no bloquearlas (OCP), pero no se implementan por adelantado.

## Restricciones técnicas

Monorepo Turborepo + npm workspaces. `apps/web`: React + Vite + TailwindCSS, puerto 5300. `apps/mobile`: React Native vía Expo. `packages/core`: TypeScript + Jest. `packages/ui`: componentes compartidos. Base de datos: PostgreSQL (Supabase en producción; contenedor Docker local en puerto 5432 para desarrollo — ver `docker-compose.yml`). Nomenclatura: tablas/columnas de base de datos en español (`clientes`, `prestamos`, `cuotas`); interfaces y clases de `@repo/core` en inglés.

## Flujo de trabajo

`spec.md` en la raíz del repositorio es la fuente única de verdad del producto — precede a cualquier decisión de arquitectura, esquema o fórmula. Un cambio de alcance o de modelo de datos se refleja primero en `spec.md`, luego en el código. Las fases de ejecución (spec → monorepo → Docker → `@repo/core`) se completan secuencialmente, con confirmación del usuario entre cada una.

## Governance

Esta constitución rige específicamente `packages/core`. Ante conflicto entre esta constitución y `spec.md`, `spec.md` decide el alcance/producto y esta constitución decide cómo se construye `@repo/core`. Cualquier excepción a un principio debe justificarse en el PR o commit correspondiente.

**Version**: 1.0.0 | **Ratified**: 2026-09-02 | **Last Amended**: 2026-09-02
