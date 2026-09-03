import { View } from 'react-native';

export interface ProgressBarProps {
  /** 0 a 1. */
  value: number;
  className?: string;
}

/** Barra de progreso de cuotas pagadas ("8 de 12 cuotas", perfil/directorio/detalle). */
export function ProgressBar({ value, className }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <View className={['h-2 overflow-hidden rounded-full bg-neutral-100', className ?? ''].join(' ')}>
      <View className="h-full rounded-full bg-brand-emerald" style={{ width: `${clamped * 100}%` }} />
    </View>
  );
}
