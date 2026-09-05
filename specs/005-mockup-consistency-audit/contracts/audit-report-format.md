# Contract: Formato del `REPORT.md`

Este contrato define la estructura obligatoria del entregable de la auditoría (`specs/005-mockup-consistency-audit/REPORT.md`), generado durante `/speckit-implement`. No es una API ni un endpoint — es el "contrato de documento" entre el proceso de auditoría (quien lo escribe) y sus consumidores (desarrolladores que corrigen hallazgos, líderes técnicos que deciden prioridad, negocio que valida sign-off), tal como exigen FR-003, FR-004, FR-007 y SC-002/SC-003.

## Estructura obligatoria

```markdown
# Auditoría de Consistencia con el Mockup Inicial

**Fecha**: [fecha de ejecución]
**Mockup de referencia**: `Docs/Plataforma Mockus/Microcreditos - Mockups.dc.html`
**Cobertura**: 8/8 artboards revisados

## Resumen ejecutivo

| Pantalla | Plataforma | Artboard(s) | Veredicto |
|---|---|---|---|
| [nombre] | movil/web | [id(s)] o "—" | ✅ Coincide / ⚠️ No coincide / ➖ Sin referencia |
| ... | | | |

**Hallazgos bloqueantes**: N — **Hallazgos menores**: N — **Hallazgos cosméticos**: N

## Detalle por pantalla

### [id-pantalla] · [Nombre de la pantalla]

- **Plataforma**: móvil / web
- **Artboard(s)**: [ids] (o "sin mockup de referencia")
- **Archivo(s)**: [rutas de código]
- **Veredicto**: [coincide / no coincide / sin referencia]

| Categoría | Severidad | Descripción | Referencia mockup | Archivo |
|---|---|---|---|---|
| color/tipografía/layout/botón | bloqueante/menor/cosmético | [esperado] vs. [encontrado] | [id artboard] | [ruta:línea] |

(Si no hay hallazgos: "Sin discrepancias encontradas.")

## Componentes compartidos

### shared-button · Button (primitivo compartido)

- **Archivos**: `packages/ui/src/primitives/Button.tsx`, `packages/ui/src/primitives-web/Button.tsx`
- **Pantallas donde se usa**: [lista de ids]
- **Veredicto**: [coincide / no coincide]
- (tabla de hallazgos igual que arriba, si aplica)

## Pantallas sin mockup de referencia

| Pantalla | Plataforma | Archivo(s) | Motivo |
|---|---|---|---|
| [nombre] | movil/web | [ruta] | Agregada en spec 003/004, o superficie que el mockup nunca cubrió |

## Priorización sugerida (User Story 3)

1. [hallazgos bloqueantes ordenados por pantalla]
2. [hallazgos menores]
3. [hallazgos cosméticos — opcional posponer]
```

## Reglas del contrato

- **Cobertura completa (FR-001, SC-001)**: la tabla de "Resumen ejecutivo" MUST tener exactamente una fila por cada entrada del catálogo de pantallas en `data-model.md` (11 filas: 7 con mockup + 4 sin referencia), sin omitir ninguna.
- **Trazabilidad (FR-003, SC-002)**: cada fila de la tabla de hallazgos MUST incluir referencia al artboard (o "—" si la pantalla es `sin_referencia`) y la ruta de archivo exacta, de forma que un desarrollador no necesite reabrir el mockup para ubicar el problema.
- **Severidad obligatoria (FR-004)**: ninguna fila de hallazgo puede omitir la columna "Severidad"; los valores permitidos son exactamente `bloqueante`, `menor`, `cosmético`.
- **No inventar coincidencia (FR-005)**: las pantallas listadas en "Pantallas sin mockup de referencia" MUST NOT aparecer con veredicto `✅ Coincide` o `⚠️ No coincide` en el resumen ejecutivo; su veredicto es siempre `➖ Sin referencia`.
- **Deduplicación de componentes compartidos**: un hallazgo sobre `Button` (u otro primitivo compartido) se registra una única vez en la sección "Componentes compartidos", listando todas las pantallas afectadas en `Pantallas donde se usa`, nunca repetido en cada sección de pantalla individual.
- **Documento único y navegable (FR-007)**: todo el contenido vive en un solo archivo `REPORT.md`; las anclas de encabezado (`### [id-pantalla]`) permiten navegar directo a una pantalla sin leer el documento completo.
- **Sin cambios de código (FR-008)**: este documento es de solo lectura respecto al código de la aplicación; cualquier corrección propuesta queda como texto en "Priorización sugerida", no como un diff o PR generado por la auditoría misma.
