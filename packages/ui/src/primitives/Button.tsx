import { ActivityIndicator, Pressable, Text } from 'react-native';
import type { ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  className?: string;
  testID?: string;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-brand-emerald',
  secondary: 'bg-white border border-neutral-200',
  ghost: 'bg-transparent',
};

const VARIANT_TEXT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'text-white',
  secondary: 'text-brand-ink',
  ghost: 'text-brand-navy',
};

/** Botón compartido web/móvil — mockups usan verde sólido para la acción primaria de cada
 * pantalla (Emitir/Confirmar cobro) y borde neutro para acciones secundarias (Compartir). */
export function Button({ label, onPress, variant = 'primary', disabled, loading, icon, className, testID }: ButtonProps) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      onPress={onPress}
      disabled={disabled || loading}
      className={[
        'flex-row items-center justify-center gap-2 rounded-xl px-4 py-3.5',
        VARIANT_CLASSES[variant],
        disabled || loading ? 'opacity-50' : '',
        className ?? '',
      ].join(' ')}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#FFFFFF' : '#0F172A'} />
      ) : (
        <>
          {icon}
          <Text className={['font-semibold text-[15px]', VARIANT_TEXT_CLASSES[variant]].join(' ')}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}
