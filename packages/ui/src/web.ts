// Primitivas DOM/Tailwind — usadas por apps/web vía `@repo/ui/web`.
// No se exportan desde el barrel raíz por el mismo motivo que ./native: mantener
// el build de apps/mobile (React Native) libre de tipos DOM/React que no usa.
export { Button } from './primitives-web/Button';
export type { ButtonProps, ButtonVariant } from './primitives-web/Button';
export { Card } from './primitives-web/Card';
export type { CardProps } from './primitives-web/Card';
export { Badge } from './primitives-web/Badge';
export type { BadgeProps, BadgeTone } from './primitives-web/Badge';
export { ProgressBar } from './primitives-web/ProgressBar';
export type { ProgressBarProps } from './primitives-web/ProgressBar';
export { Chip } from './primitives-web/Chip';
export type { ChipProps } from './primitives-web/Chip';
export { Avatar } from './primitives-web/Avatar';
export type { AvatarProps } from './primitives-web/Avatar';
