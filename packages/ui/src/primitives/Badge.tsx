import { Text, View } from 'react-native';

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

/** Pastilla de estado — usada para "Al día"/"Mora N días"/"Vence hoy" (directorio, ruta de
 * cobranza) y para el grado de score A+/A/B/C (perfil 360°, FR-010: siempre con texto, nunca
 * solo color). */
export function Badge({ label, tone = 'neutral', className, testID }: BadgeProps) {
  return (
    <View testID={testID} className={['self-start rounded-full px-2.5 py-1', TONE_CLASSES[tone], className ?? ''].join(' ')}>
      <Text className="text-xs font-bold">{label}</Text>
    </View>
  );
}
