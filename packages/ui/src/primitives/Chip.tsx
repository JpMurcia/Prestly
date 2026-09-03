import { Pressable, Text } from 'react-native';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  className?: string;
  testID?: string;
}

/** Chip de filtro/parámetro — "Todos · 24", "Cobranza hoy · 5", "$500", "Semanal". */
export function Chip({ label, selected, onPress, className, testID }: ChipProps) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      className={[
        'rounded-lg px-2.5 py-1.5',
        selected ? 'bg-brand-ink' : 'bg-neutral-100',
        className ?? '',
      ].join(' ')}
    >
      <Text className={['text-[11.5px] font-bold', selected ? 'text-white' : 'text-brand-ink'].join(' ')}>
        {label}
      </Text>
    </Pressable>
  );
}
