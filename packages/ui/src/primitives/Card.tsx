import { View } from 'react-native';
import type { ReactNode } from 'react';

export interface CardProps {
  children: ReactNode;
  className?: string;
  testID?: string;
}

/** Contenedor blanco con borde sutil y esquinas redondeadas — el patrón de tarjeta que
 * repiten todos los mockups (fondo #fff, borde #E2E8F0, radio 12px). */
export function Card({ children, className, testID }: CardProps) {
  return (
    <View testID={testID} className={['rounded-xl border border-neutral-200 bg-white p-4', className ?? ''].join(' ')}>
      {children}
    </View>
  );
}
