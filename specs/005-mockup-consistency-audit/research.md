# Phase 0 Research: Auditoría de Consistencia con el Mockup Inicial

No quedaron marcadores `NEEDS CLARIFICATION` en el Technical Context del plan (todos los campos son N/A o se resolvieron con la información ya disponible en el repositorio). Esta investigación documenta las decisiones tomadas para poder ejecutar la auditoría de forma consistente en `/speckit-tasks` y `/speckit-implement`.

## 1. Identidad del mockup inicial

- **Decision**: El mockup inicial es `Docs/Plataforma Mockus/Microcreditos - Mockups.dc.html`, un lienzo de diseño ("Design Canvas") con 2 turnos y 8 artboards: `1a`, `1b`, `1c` (turno inicial, 3 pantallas) y `2a`–`2e` (ampliación, 5 pantallas).
- **Rationale**: Es el único archivo `*mockup*` del repositorio (`Glob **/*mockup*` solo devuelve esta carpeta) y los tokens de diseño en `packages/ui/src/tokens/` citan explícitamente "mockups Turno 2 intro" en sus comentarios, confirmando que este archivo es la fuente de la que ya se extrajeron colores y tipografía.
- **Alternatives considered**: Buscar un mockup en Figma/enlace externo — descartado porque no hay referencias a URLs externas de diseño en `spec.md`, `README` ni en los `plan.md`/`research.md` de las specs 001–004.

## 2. Mapeo pantalla del mockup → componente de código

- **Decision**: Usar el mapeo documentado en `plan.md` §Project Structure, construido cruzando las etiquetas de cada artboard (`dv-olabel`) contra los nombres de pantallas/componentes de `apps/mobile/src/screens`, `apps/mobile/src/components`, `apps/web/src/pages` y `apps/web/src/components`.
- **Rationale**: Los nombres de las pantallas del mockup (p. ej. "Directorio de clientes y cartera") corresponden 1:1 con nombres de archivo (`ClientDirectoryScreen.tsx`) y con las user stories de las specs 001/002 ya implementadas, lo que hace el mapeo verificable por inspección de código, no por suposición.
- **Alternatives considered**: Auditar por ruta de navegación (`router.tsx`) en vez de por archivo de pantalla — descartado porque el mockup describe vistas visuales, no rutas, y una misma pantalla puede tener múltiples rutas de entrada.

## 3. Pantallas sin artboard de referencia

- **Decision**: `IssueLoanSheet.tsx` (móvil), y `QuoteCalculatorPage.tsx`, `ActiveLoansPage.tsx`, `WhatsAppConfigPage.tsx` (web) no tienen artboard propio en el mockup inicial y se documentan en el reporte como "sin referencia", nunca como "coincide" o "no coincide".
- **Rationale**: El mockup solo cubre 8 pantallas explícitas (edge case ya identificado en `spec.md`); estas 4 vistas corresponden a funcionalidad de las specs 003/004 (posteriores al mockup) o a una superficie web que el mockup nunca representó (la calculadora solo se mockeó en móvil).
- **Alternatives considered**: Excluirlas por completo del reporte — descartado porque FR-005 exige señalarlas explícitamente en vez de omitirlas.

## 4. Componentes compartidos auditados una sola vez

- **Decision**: `packages/ui/src/primitives/Button.tsx` (RN) y `packages/ui/src/primitives-web/Button.tsx` (DOM) se auditan como una sola entrada de "componente compartido" con sus 3 variantes (`primary`/`secondary`/`ghost`), en vez de repetir el hallazgo en cada pantalla que use un botón.
- **Rationale**: Ambos archivos ya comparten el mismo contrato de props y el mismo mapeo de variante→color (verde sólido para acción primaria, borde neutro para secundaria), documentado en sus propios comentarios como fiel al mockup. Auditarlos una vez evita duplicar 8 veces el mismo hallazgo si hubiera una discrepancia de color en el botón compartido.
- **Alternatives considered**: Auditar el botón dentro de cada pantalla que lo usa — descartado por el edge case de "componente compartido" ya definido en `spec.md` (evitar duplicación de hallazgos).

## 5. Fuente de verdad auxiliar para color y tipografía

- **Decision**: Usar `packages/ui/src/tokens/colors.ts` y `packages/ui/src/tokens/typography.ts` como referencia verificable en código (valores hex y familias tipográficas exactas), complementaria a la inspección visual directa del archivo `.dc.html`.
- **Rationale**: FR-006 lo exige explícitamente, y estos tokens ya fueron extraídos por el equipo directamente del mockup (comentarios en el propio archivo lo confirman), por lo que sirven como oráculo de bajo costo para detectar drift de código sin tener que releer el mockup completo en cada verificación.
- **Alternatives considered**: Confiar solo en inspección visual — descartado porque un color visualmente similar en pantalla puede provenir de un valor hex distinto al documentado, lo cual FR-006 exige detectar aunque "luzca similar".

## 6. Formato del entregable

- **Decision**: Un único documento Markdown `REPORT.md` en `specs/005-mockup-consistency-audit/`, con una tabla resumen (veredicto por pantalla) seguida de una sección detallada por pantalla con sus hallazgos, siguiendo el esquema fijado en `contracts/audit-report-format.md`.
- **Rationale**: SC-002 y SC-003 exigen que un desarrollador o un revisor de negocio puedan entender el estado de cada pantalla sin reabrir la app ni el mockup; un único documento navegable (con tabla de resumen + anclas por pantalla) cumple ambos sin necesitar herramientas adicionales.
- **Alternatives considered**: Un issue/ticket por discrepancia en un tracker externo — descartado porque el repositorio no tiene un tracker configurado como fuente de verdad (no hay referencia en memoria de proyecto a Linear/GitHub Issues para este propósito) y porque FR-007 pide un documento único y navegable, no un conjunto disperso de tickets.

**Output**: Todas las incógnitas del Technical Context quedan resueltas; no quedan `NEEDS CLARIFICATION` pendientes para Phase 1.
