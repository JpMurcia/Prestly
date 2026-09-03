/** Paleta de spec.md raíz §9 — misma fuente que apps/mobile/tailwind.config.js theme.colors.brand. */
export const colors = {
  emerald: '#10B981',
  navy: '#1E3A8A',
  ink: '#0F172A',

  // Estados de cartera (mockups Turno 2 intro): acento izquierdo, no relleno de fondo.
  status: {
    alDia: { text: '#15803D', bg: '#F0FDF4', accent: '#10B981' },
    cobroHoy: { text: '#B45309', bg: '#FFFBEB', accent: '#F59E0B' },
    mora: { text: '#B91C1C', bg: '#FEF2F2', accent: '#DC2626' },
  },

  // Bandas de score de confianza (spec.md raíz §4/§9): A+ ≥95% · A 85–94% · B 70–84% · C <70%.
  score: {
    aPlus: { text: '#047857', bg: '#ECFDF5' },
    a: { text: '#15803D', bg: '#F0FDF4' },
    b: { text: '#B45309', bg: '#FFFBEB' },
    c: { text: '#B91C1C', bg: '#FEF2F2' },
  },

  neutral: {
    50: '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    400: '#94A3B8',
    500: '#64748B',
    900: '#0F172A',
  },
} as const;
