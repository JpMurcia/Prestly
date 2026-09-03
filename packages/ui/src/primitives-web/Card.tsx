import type { ReactNode } from 'react';

export interface CardProps {
  children: ReactNode;
  className?: string;
  testID?: string;
}

/** Contenedor blanco con borde sutil y esquinas redondeadas — el patrón de tarjeta que
 * repiten los mockups (fondo #fff, borde #E2E8F0, radio 12px). Versión DOM de ./native. */
export function Card({ children, className, testID }: CardProps) {
  return (
    <div data-testid={testID} className={['rounded-xl border border-neutral-200 bg-white p-4', className ?? ''].join(' ')}>
      {children}
    </div>
  );
}
