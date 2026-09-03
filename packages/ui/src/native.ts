// Primitivas de React Native (NativeWind) — usadas por apps/mobile vía `@repo/ui/native`.
// No se exportan desde el barrel raíz para no filtrar tipos de React Native al build de
// apps/web (React DOM), que no tiene NativeWind ni react-native instalados.
export { Button } from './primitives/Button';
export type { ButtonProps, ButtonVariant } from './primitives/Button';
export { Card } from './primitives/Card';
export type { CardProps } from './primitives/Card';
export { Badge } from './primitives/Badge';
export type { BadgeProps, BadgeTone } from './primitives/Badge';
export { ProgressBar } from './primitives/ProgressBar';
export type { ProgressBarProps } from './primitives/ProgressBar';
export { Chip } from './primitives/Chip';
export type { ChipProps } from './primitives/Chip';
export { Avatar } from './primitives/Avatar';
export type { AvatarProps } from './primitives/Avatar';
