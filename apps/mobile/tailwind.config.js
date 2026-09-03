/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './App.tsx',
    './src/**/*.{js,jsx,ts,tsx}',
    '../../packages/ui/src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Paleta de spec.md raíz §9 — mismos tokens que packages/ui/src/tokens/colors.ts
        brand: {
          emerald: '#10B981',
          navy: '#1E3A8A',
          ink: '#0F172A',
        },
      },
      fontFamily: {
        display: ['PlusJakartaSans_700Bold'],
        body: ['Inter_400Regular'],
      },
    },
  },
  plugins: [],
};
