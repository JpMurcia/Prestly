export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  className?: string;
  testID?: string;
}

/** Chip de filtro/parámetro — "Todos · 24", "Cobranza hoy · 5". Versión DOM de ./native.
 * Pastilla completamente redondeada (mockups: `border-radius:999px`), no una esquina de tarjeta. */
export function Chip({ label, selected, onPress, className, testID }: ChipProps) {
  return (
    <button
      type="button"
      data-testid={testID}
      onClick={onPress}
      disabled={!onPress}
      className={[
        'rounded-full px-2.5 py-1.5 disabled:cursor-default',
        selected ? 'bg-brand-ink' : 'bg-neutral-100',
        className ?? '',
      ].join(' ')}
    >
      <span className={['text-[11.5px] font-bold', selected ? 'text-white' : 'text-brand-ink'].join(' ')}>{label}</span>
    </button>
  );
}
