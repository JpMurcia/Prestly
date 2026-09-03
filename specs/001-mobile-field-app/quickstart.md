# Quickstart: App Móvil de Cobranza en Campo

Guía para levantar el entorno y validar de punta a punta las 4 historias de usuario de [spec.md](./spec.md). No sustituye a `tasks.md` (implementación) — asume que las tareas de esa fase ya están hechas.

## Prerrequisitos

- Node.js ≥20, npm (`packageManager` fijado en `package.json` raíz)
- Docker Desktop (para el stack local de Supabase — ver `research.md` §6)
- Expo Go (dispositivo físico) o un simulador iOS/Android configurado
- Supabase CLI (`npm install -g supabase` o vía `npx supabase`)

## Levantar el entorno

```bash
# 1. Instalar dependencias del monorepo
npm install

# 2. Levantar Postgres local (Supabase CLI, puerto 5432 por convención de la constitución)
npx supabase start

# 3. Aplicar las migraciones (esquema de spec.md raíz §4)
npx supabase db reset

# 4. Arrancar la app móvil (Turborepo filtra al workspace "mobile")
npm run dev -- --filter=mobile
```

Escanear el QR con Expo Go, o presionar `i`/`a` en la terminal de Expo para abrir el simulador iOS/Android.

## Escenario de referencia

Usar el caso verificado en `spec.md` raíz §5.1 en todas las validaciones: **capital $500, tasa 15%, 12 cuotas semanales → cuota $47.92, interés total $75.00, total a pagar $575.00**.

## Validación por historia de usuario

### US1 — Cotizar y emitir (P1)

1. Abrir la Calculadora. Ajustar monto a $500, tasa a 15%, frecuencia semanal, 12 cuotas.
   - **Esperado**: total $575.00, cuota $47.92, ganancia +$75.00 — recalculado al instante, sin indicador de carga de red (FR-001).
2. Poner el dispositivo en modo avión y repetir el paso 1.
   - **Esperado**: el resultado no cambia (SC-006 — cotizar funciona 100% offline).
3. Salir de modo avión. Tocar "Ver la tabla completa".
   - **Esperado**: 12 filas, capital $41.67 e interés $6.25 por fila salvo el ajuste de redondeo en la última, con fila de totales = $500.00 / $75.00 / $575.00 (FR-002).
4. Tocar "Emitir este préstamo", capturar un cliente nuevo (nombre + teléfono).
   - **Esperado**: navega al detalle del préstamo recién creado; el cliente aparece de inmediato en el Directorio (US3) y, si su primera cuota vence hoy o antes, en la Ruta de cobranza (US2).

### US2 — Cobrar en la ruta de cobranza diaria (P1)

1. Con el préstamo emitido en US1 (fecha de emisión = hoy), abrir la Ruta de cobranza.
   - **Esperado**: el cliente aparece si su primera cuota vence hoy o antes; el resumen del día muestra el monto esperado.
2. Tocar el botón de cobro rápido del cliente. Ingresar un monto recibido igual al de la cuota ($47.92) y confirmar.
   - **Esperado**: la cuota pasa a "pagado", desaparece de la lista de pendientes, el resumen del día se actualiza (FR-008/FR-009).
3. Repetir con un monto recibido mayor (ej. $50.00) en otra cuota.
   - **Esperado**: se muestra "Cambio a entregar: $2.08" antes de confirmar.
4. Poner el dispositivo en modo avión y repetir el paso 2 en una cuota distinta.
   - **Esperado**: aviso claro de sin conexión antes de intentar guardar; la cuota sigue "pendiente" (FR-013).

### US3 — Directorio y cartera (P2)

1. Abrir el Directorio. Buscar por parte del nombre o teléfono del cliente creado en US1.
   - **Esperado**: aparece en los resultados (FR-005).
2. Tocar cada filtro de estado ("Cobro hoy", "Al día", "Mora").
   - **Esperado**: la lista y el conteo del filtro coinciden con los clientes en ese estado.
3. Buscar un texto que no coincide con ningún cliente.
   - **Esperado**: estado vacío con mensaje, no una lista en blanco.

### US4 — Perfil 360° (P3)

1. Abrir el perfil del cliente de US1 antes de que tenga ninguna cuota vencida.
   - **Esperado**: score mostrado como "sin historial", no como error ni como C (FR-010).
2. Tras registrar al menos un cobro a tiempo (US2) y que exista alguna cuota histórica vencida, volver a abrir el perfil.
   - **Esperado**: score con letra + fracción visible (ej. "1 de 1 cuotas"), nunca solo la letra.
3. Escribir una nota privada y volver a entrar al perfil.
   - **Esperado**: la nota persiste con su fecha de actualización (FR-012).
4. Revisar la sección de historial de préstamos.
   - **Esperado**: aparece el préstamo activo de US1 con su progreso.

## Pruebas automatizadas equivalentes

- `packages/core`: `npm test --workspace=@repo/core` — debe incluir el caso $500/15%/12→$47.92 (constitución III) antes de cualquier otro test.
- `apps/mobile`: `npm test --workspace=mobile` — un test de Testing Library por pantalla listado en Project Structure de `plan.md`, cubriendo al menos el escenario 1 de cada historia de usuario arriba.
