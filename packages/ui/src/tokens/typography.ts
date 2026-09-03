/**
 * Tipografías de spec.md raíz §9. Los nombres de familia coinciden con las claves que
 * expone @expo-google-fonts/plus-jakarta-sans y @expo-google-fonts/inter — cargarlas con
 * expo-font (useFonts) antes de montar la navegación (ver apps/mobile/App.tsx).
 */
export const fontFamily = {
  display: 'PlusJakartaSans_700Bold',
  displayExtraBold: 'PlusJakartaSans_800ExtraBold',
  displaySemiBold: 'PlusJakartaSans_600SemiBold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemiBold: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
} as const;

/** Cifras de dinero: siempre tabular-nums + alineación derecha (mockups, Turno 2 intro). */
export const monetaryTextStyle = {
  fontVariant: ['tabular-nums'] as const,
  textAlign: 'right' as const,
};
