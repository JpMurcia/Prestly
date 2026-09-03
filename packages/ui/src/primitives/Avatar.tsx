import { Text, View } from 'react-native';

export interface AvatarProps {
  name: string;
  size?: number;
  className?: string;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

/** Círculo con iniciales — placeholder de foto de cliente en tarjetas/perfiles/filas. */
export function Avatar({ name, size = 34, className }: AvatarProps) {
  return (
    <View
      className={['items-center justify-center rounded-full bg-neutral-200', className ?? ''].join(' ')}
      style={{ width: size, height: size }}
    >
      <Text className="text-[11px] font-bold text-neutral-500">{initials(name)}</Text>
    </View>
  );
}
