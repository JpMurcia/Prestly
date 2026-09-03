# Quickstart: Admin Web — Dashboard y Gestión de Cartera

Guía para levantar el entorno y validar de punta a punta las 4 historias de usuario de [spec.md](./spec.md). No sustituye a `tasks.md` (implementación) — asume que las tareas de esa fase ya están hechas. Reutiliza la misma base de datos que `specs/001-mobile-field-app/` — no hace falta una cartera separada, sirve la misma con la que ya se validó la app móvil.

## Prerrequisitos

- Node.js ≥20, npm (`packageManager` fijado en `package.json` raíz)
- El stack local de Supabase de `specs/001-mobile-field-app/quickstart.md` ya levantado, con la migración nueva de esta feature aplicada (`0003_cartera_resumen.sql`)
- Un navegador moderno (Chrome/Edge/Firefox recientes) — sin requisito de dispositivo físico ni simulador, a diferencia de la app móvil

## Levantar el entorno

```bash
# 1. Instalar dependencias del monorepo (si no se hizo ya)
npm install

# 2. Levantar Postgres local y aplicar migraciones (incluye 0003_cartera_resumen.sql)
npx supabase start
npx supabase db reset

# 3. Arrancar la web (Turborepo filtra al workspace "web")
npm run dev -- --filter=web
```

Abrir `http://localhost:5300`.

## Datos de referencia

Reutilizar el mismo escenario verificado en `spec.md` raíz §5.1 y en `specs/001-mobile-field-app/quickstart.md`: **capital $500, tasa 15%, 12 cuotas semanales → cuota $47.92, interés total $75.00, total a pagar $575.00**. Para validar SC-005 de esta spec (paridad centavo a centavo entre plataformas), cotizar la misma entrada en la app móvil y en la web y comparar.

## Validación por historia de usuario

### US1 — Dashboard (P1)

1. Con al menos un préstamo activo y una cuota pagada (creados en `specs/001-mobile-field-app/quickstart.md` o directo en esta sesión), abrir el dashboard (`/`).
   - **Esperado**: capital prestado, total recuperado, intereses ganados y cartera en mora se muestran, y coinciden con la suma manual de los préstamos/cuotas existentes (FR-001).
2. Registrar el cobro de una cuota pendiente (ver US2 más abajo) y volver al dashboard.
   - **Esperado**: las cuatro métricas se actualizan sin recargar la página a mano (invalidación de caché, `research.md` §3).
3. Con una cartera sin ninguna cuota vencida sin pagar, revisar la métrica de mora.
   - **Esperado**: muestra $0 de forma clara, no un error (edge case "cartera vacía").

### US2 — Préstamos activos y registrar cobro (P1)

1. Abrir "Préstamos activos" (`/prestamos`).
   - **Esperado**: lista todos los préstamos activos con su cliente, monto y progreso, buscable por nombre/teléfono/número de préstamo (FR-002).
2. Abrir un préstamo específico (`/prestamos/:id`).
   - **Esperado**: tabla de amortización completa con las N cuotas y filtros "todas/pagadas/pendientes/vence hoy" (FR-003).
3. Registrar el cobro de la cuota que vence hoy.
   - **Esperado**: pasa a "pagado" de inmediato, el saldo restante se actualiza, deja de aparecer como pendiente (FR-004).
4. Exportar la lista de préstamos activos.
   - **Esperado**: se descarga un archivo con las filas visibles (respetando búsqueda/filtros aplicados, FR-007).
5. Intentar cobrar la misma cuota simultáneamente desde la web y desde la app móvil (dos pestañas/dispositivos apuntando a la misma cuota pendiente).
   - **Esperado**: solo una de las dos operaciones se completa; la otra muestra un aviso de que la cuota ya fue cobrada (FR-012/SC-006).

### US3 — Directorio/CRM con panel de detalle (P2)

1. Abrir el directorio (`/clientes`). Buscar por nombre parcial o teléfono.
   - **Esperado**: la lista se filtra a los clientes que coinciden (FR-005).
2. Aplicar cada filtro de estado ("Cobranza hoy", "Al día", "En mora").
   - **Esperado**: la lista y el conteo del filtro coinciden con los clientes en ese estado.
3. Seleccionar un cliente.
   - **Esperado**: se abre el panel de detalle (drawer) con score, montos y tabla de amortización más reciente, sin navegar a otra URL (FR-006).
4. Registrar un cobro desde el panel de detalle.
   - **Esperado**: mismo comportamiento que US2 paso 3 — la cuota pasa a pagado y el panel lo refleja de inmediato.

### US4 — Cotizar y emitir desde escritorio (P3)

1. Abrir la calculadora (`/calculadora`). Ajustar monto a $500, tasa 15%, 12 cuotas semanales.
   - **Esperado**: total $575.00, cuota $47.92 — idéntico centavo a centavo a lo que produce la app móvil para la misma entrada (SC-005).
2. Confirmar "Emitir este préstamo" para un cliente nuevo (nombre + teléfono).
   - **Esperado**: el préstamo aparece de inmediato en "Préstamos activos" (US2) y en el directorio (US3).

## Pruebas automatizadas equivalentes

- `packages/core`: sin cambios de comportamiento — `npm test --workspace=@repo/core` debe seguir pasando (incluye el caso $500/15%/12→$47.92, constitución III); se añaden tests para los nuevos tipos (`IPortfolioReader`, `ActiveLoanSummary`) si `tasks.md` introduce lógica nueva ahí.
- `packages/data-supabase`: `npm test --workspace=@repo/data-supabase` — tests de mapeo fila↔dominio para `SupabasePortfolioReader` y `SupabaseLoanRepository.listActive`.
- `apps/web`: `npm test --workspace=web` (Vitest + Testing Library) — un test por página listada en Project Structure de `plan.md`, cubriendo al menos el escenario 1 de cada historia de usuario arriba.
- `apps/mobile`: `npm test --workspace=mobile` — debe seguir pasando sin cambios de comportamiento tras el refactor a `@repo/data-supabase` (regresión, no funcionalidad nueva).
