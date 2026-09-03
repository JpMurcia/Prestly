import type { ReactElement, ReactNode } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render as rtlRender } from '@testing-library/react-native';

/** Envuelve un componente con los providers que la app real monta en App.tsx, para que las
 * pantallas puedan usar useNavigation()/useQuery() en tests sin montar toda la app. */
function AllProviders({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return (
    <QueryClientProvider client={queryClient}>
      <NavigationContainer>{children}</NavigationContainer>
    </QueryClientProvider>
  );
}

export function renderScreen(ui: ReactElement) {
  return rtlRender(ui, { wrapper: AllProviders });
}

export * from '@testing-library/react-native';
