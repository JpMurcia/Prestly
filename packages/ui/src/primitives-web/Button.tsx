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

/** Botón compartido web/móvil — mismo contrato que ./native, versión DOM/Tailwind
 * (packages/ui/src/primitives/Button.tsx). Mockups usan verde sólido para la acción
 * primaria de cada pantalla (Emitir/Registrar cobro) y borde neutro para secundarias. */
export function Button({ label, onPress, variant = 'primary', disabled, loading, icon, className, testID }: ButtonProps) {
  return (
    <button
      type="button"
      data-testid={testID}
      onClick={onPress}
      disabled={disabled || loading}
      className={[
        'flex flex-row items-center justify-center gap-2 rounded-xl px-4 py-3.5 disabled:cursor-not-allowed',
        VARIANT_CLASSES[variant],
        disabled || loading ? 'opacity-50' : '',
        className ?? '',
      ].join(' ')}
    >
      {loading ? (
        <span
          aria-hidden
          className={[
            'h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent',
            VARIANT_TEXT_CLASSES[variant],
          ].join(' ')}
        />
      ) : (
        <>
          {icon}
          <span className={['font-semibold text-[15px]', VARIANT_TEXT_CLASSES[variant]].join(' ')}>{label}</span>
        </>
      )}
    </button>
  );
}
