import { Pressable, Text, View } from 'react-native';

export interface SegmentedControlOption {
  value: string;
  label: string;
}

export interface SegmentedControlProps {
  options: SegmentedControlOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  testID?: string;
}

/** Control de dos (o más) pestañas con la activa elevada sobre fondo blanco — mockup 2a
 * "Ver resumen/Ver tabla completa" (specs/006-rebrand-currency-polish/, REPORT.md hallazgo
 * "boton"/cosmético de mobile-quote-calculator). No es un `Chip` (selección múltiple de
 * filtros) ni un `Button` — alterna entre exactamente una de N vistas. */
export function SegmentedControl({ options, value, onChange, className, testID }: SegmentedControlProps) {
  return (
    <View testID={testID} className={['flex-row gap-1 rounded-[9px] bg-neutral-100 p-1', className ?? ''].join(' ')}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            className={[
              'flex-1 items-center rounded-[7px] py-2',
              active ? 'bg-white shadow-sm' : 'bg-transparent',
            ].join(' ')}
          >
            <Text className={['text-[12.5px] font-bold', active ? 'text-brand-ink' : 'text-neutral-400'].join(' ')}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
