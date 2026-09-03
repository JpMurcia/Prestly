export type BadgeTone = 'alDia' | 'cobroHoy' | 'mora' | 'scoreAPlus' | 'scoreA' | 'scoreB' | 'scoreC' | 'neutral';

const TONE_CLASSES: Record<BadgeTone, string> = {
  alDia: 'bg-[#F0FDF4] text-[#15803D]',
  cobroHoy: 'bg-[#FFFBEB] text-[#B45309]',
  mora: 'bg-[#FEF2F2] text-[#B91C1C]',
  scoreAPlus: 'bg-[#ECFDF5] text-[#047857]',
  scoreA: 'bg-[#F0FDF4] text-[#15803D]',
  scoreB: 'bg-[#FFFBEB] text-[#B45309]',
  scoreC: 'bg-[#FEF2F2] text-[#B91C1C]',
  neutral: 'bg-neutral-100 text-neutral-500',
};

export interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  className?: string;
  testID?: string;
}

/** Pastilla de estado — "Al día"/"Mora N días"/"Vence hoy" (préstamos activos, directorio)
 * y grado de score A+/A/B/C, siempre con texto, nunca solo color. Versión DOM de ./native. */
export function Badge({ label, tone = 'neutral', className, testID }: BadgeProps) {
  return (
    <span
      data-testid={testID}
      className={['inline-block self-start rounded-full px-2.5 py-1', TONE_CLASSES[tone], className ?? ''].join(' ')}
    >
      <span className="text-xs font-bold">{label}</span>
    </span>
  );
}
