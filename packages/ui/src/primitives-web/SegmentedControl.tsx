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

/** Control de dos (o más) pestañas con la activa elevada sobre fondo blanco. Versión DOM de
 * ./native — mismo criterio de `Chip`/`Badge`: primitivo compartido por ambas plataformas para
 * no reintroducir el drift ad-hoc que señaló specs/005-mockup-consistency-audit/REPORT.md. */
export function SegmentedControl({ options, value, onChange, className, testID }: SegmentedControlProps) {
  return (
    <div data-testid={testID} className={['flex gap-1 rounded-[9px] bg-neutral-100 p-1', className ?? ''].join(' ')}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={active}
            className={[
              'flex-1 rounded-[7px] py-2 text-[12.5px] font-bold',
              active ? 'bg-white text-brand-ink shadow-sm' : 'bg-transparent text-neutral-400',
            ].join(' ')}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
