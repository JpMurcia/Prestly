import { fromDateOnly, toDateOnly } from '../src/dateOnly';

describe('dateOnly', () => {
  it('fromDateOnly conserva el día calendario del DATE de Postgres sin desplazarlo por huso horario', () => {
    const date = fromDateOnly('2026-09-10');

    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(8); // septiembre (0-indexado)
    expect(date.getDate()).toBe(10);
  });

  it('toDateOnly conserva el día calendario local sin convertir a UTC primero', () => {
    const date = new Date(2026, 8, 10); // 10 de septiembre de 2026, medianoche local

    expect(toDateOnly(date)).toBe('2026-09-10');
  });

  it('toDateOnly(fromDateOnly(x)) === x para cualquier fecha calendario (round-trip exacto)', () => {
    for (const original of ['2026-01-01', '2026-09-10', '2026-12-31', '2099-01-01']) {
      expect(toDateOnly(fromDateOnly(original))).toBe(original);
    }
  });

  it('regresión: fromDateOnly no debe volver a ser `new Date(dateOnly)` (medianoche UTC) — ese parseo cae en el día anterior al formatear en un huso horario detrás de UTC', () => {
    const fixed = fromDateOnly('2026-09-10');
    expect(fixed.getDate()).toBe(10);

    // `new Date('2026-09-10')` es exactamente el parseo defectuoso que este módulo reemplaza.
    // Solo lo comparamos donde de verdad haría diferencia: hosts en huso horario detrás de UTC
    // (getTimezoneOffset > 0 — toda Latinoamérica, el mercado de este producto es-DO). En un
    // host en UTC (offset 0, típico en CI) ambos parseos coinciden y no hay nada que comparar.
    if (new Date().getTimezoneOffset() > 0) {
      const buggy = new Date('2026-09-10');
      expect(buggy.getDate()).not.toBe(10);
    }
  });
});
