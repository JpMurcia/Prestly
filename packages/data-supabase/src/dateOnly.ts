/**
 * Conversión entre los `DATE` de Postgres (sin hora ni huso horario — `fecha_vencimiento`,
 * `fecha_emision`) y `Date` de JS, tratándolos siempre como fecha calendario local, nunca como
 * instante UTC. `new Date('YYYY-MM-DD')` interpreta la cadena como medianoche UTC (regla del
 * spec de ECMAScript); en cualquier huso horario detrás de UTC (toda Latinoamérica) eso muestra
 * un día antes al formatear en hora local con `toLocaleDateString` — confirmado contra Postgres
 * real en specs/002-admin-web/tasks.md T048 (huso America/Bogota, UTC-5). Estas dos funciones
 * son la única forma correcta de cruzar esa frontera para un `DATE` sin hora; no aplican a
 * columnas `TIMESTAMPTZ` (`fecha_pago`, `creado_en`, `notas_actualizadas_en`), que sí llevan
 * offset explícito y `new Date(...)` interpreta correctamente.
 */
export function toDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function fromDateOnly(dateOnly: string): Date {
  const [year, month, day] = dateOnly.split('-').map(Number) as [number, number, number];
  return new Date(year, month - 1, day);
}
