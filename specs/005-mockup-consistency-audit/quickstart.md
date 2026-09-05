# Quickstart: Ejecutar y validar la auditoría de consistencia con el mockup

Esta guía valida que la auditoría (User Stories 1–3 de `spec.md`) se puede ejecutar de punta a punta y que el entregable cumple el contrato de `contracts/audit-report-format.md`.

## Prerrequisitos

- Repositorio en la raíz `C:\Users\Usuario\Documents\GitHub\Prestly`, rama `005-mockup-consistency-audit`.
- Node.js y dependencias instaladas (`npm install` en la raíz del monorepo) para poder levantar `apps/web` y `apps/mobile` en modo desarrollo.
- Ninguna credencial ni acceso externo es necesario: el mockup es un archivo estático local (`Docs/Plataforma Mockus/Microcreditos - Mockups.dc.html`).

## Paso 1 — Abrir el mockup de referencia

Abrir directamente en el navegador (doble clic o `start` en Windows) el archivo:

```text
Docs/Plataforma Mockus/Microcreditos - Mockups.dc.html
```

Confirmar que se ven los 8 artboards (`1a`, `1b`, `1c`, `2a`, `2b`, `2c`, `2d`, `2e`) navegando por sus anclas (`#1a`, `#2a`, etc.).

## Paso 2 — Levantar la app web para comparar

```bash
npm run dev --workspace=apps/web
```

Abrir `http://localhost:5300` y navegar a: Dashboard (`1c`), Amortización (`1c`), Directorio de clientes + drawer (`2e`).

## Paso 3 — Levantar la app móvil para comparar

```bash
npm run start --workspace=apps/mobile
```

Abrir en simulador/Expo Go y navegar a: Calculadora (`1a`/`2a`), Detalle de cliente + registro de pago (`1b`), Directorio de clientes (`2b`), Perfil 360°/detalle de préstamo (`2c`), Ruta de cobranza (`2d`).

## Paso 4 — Comparar contra el catálogo de pantallas

Para cada fila de la tabla en `data-model.md` (catálogo de 11 pantallas: 7 con mockup + 4 sin referencia + el componente compartido `Button`):

1. Ubicar el artboard correspondiente en el mockup (o confirmar que no existe, para las `sin_referencia`).
2. Verificar las 4 categorías del FR-002: color (contra el mockup y contra `packages/ui/src/tokens/colors.ts`), tipografía (contra `packages/ui/src/tokens/typography.ts`), layout, y botones (contra `packages/ui/src/primitives{,-web}/Button.tsx`).
3. Registrar cualquier diferencia como fila de hallazgo, con severidad, según las reglas de `data-model.md` y el formato de `contracts/audit-report-format.md`.

## Paso 5 — Generar `REPORT.md`

Escribir (o actualizar) `specs/005-mockup-consistency-audit/REPORT.md` siguiendo exactamente la estructura de `contracts/audit-report-format.md`.

## Validación de éxito

- [ ] **SC-001**: la tabla de resumen ejecutivo tiene 11 filas (7 con artboard + 4 sin referencia), cada una con un veredicto no vacío.
- [ ] **SC-002**: tomar 2 hallazgos al azar del reporte y confirmar que, leyendo solo su fila (categoría, descripción, referencia de artboard, archivo), se puede abrir el archivo de código señalado y localizar el problema en menos de 5 minutos, sin volver a abrir el mockup.
- [ ] **SC-003**: pedir a alguien que no participó en la auditoría que lea únicamente el "Resumen ejecutivo" y el conteo de "Hallazgos bloqueantes" y determine si el estado visual es apto para presentar a stakeholders.
- [ ] **SC-004**: hacer una segunda pasada rápida sobre las 8 pantallas con mockup, enfocada solo en severidad `bloqueante`, y confirmar que no aparece ningún hallazgo nuevo que el reporte no tuviera ya.
- [ ] El reporte no incluye ningún cambio de código (FR-008) — `git status` no muestra modificaciones fuera de `specs/005-mockup-consistency-audit/`.
