export const UI_PACKAGE_NAME = '@repo/ui';

// Solo tokens (datos puros, sin JSX) — apto para cualquier plataforma (apps/web incluida).
// Las primitivas de React Native están en './native' (import '@repo/ui/native'), para que
// el build de apps/web (React DOM, sin NativeWind) nunca las type-checkee.
export { colors } from './tokens/colors';
export { fontFamily, monetaryTextStyle } from './tokens/typography';
