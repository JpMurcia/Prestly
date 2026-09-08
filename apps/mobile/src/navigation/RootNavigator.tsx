import { NavigationContainer, type NavigatorScreenParams } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { CollectionRouteScreen } from '../screens/CollectionRouteScreen';
import { ClientDirectoryScreen } from '../screens/ClientDirectoryScreen';
import { QuoteCalculatorScreen } from '../screens/QuoteCalculatorScreen';
import { ClientProfileScreen } from '../screens/ClientProfileScreen';
import { LoanDetailScreen } from '../screens/LoanDetailScreen';

export type TabParamList = {
  RutaHoy: undefined;
  Directorio: undefined;
  /** `prefilledClientId` — acción "Nuevo préstamo" del perfil 360°
   * (specs/006-rebrand-currency-polish/, US4): abre la calculadora con el cliente ya elegido. */
  Calculadora: { prefilledClientId?: string } | undefined;
};

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  Perfil: { clientId: string };
  DetallePrestamo: { loanId: string };
};

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

/** Raíz de tabs (Ruta de hoy / Directorio / Calculadora) — cada historia de usuario
 * registra su pantalla aquí al completarse (tasks.md T034/T043/T048). */
function Tabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="RutaHoy" component={CollectionRouteScreen} options={{ title: 'Ruta de hoy' }} />
      <Tab.Screen name="Directorio" component={ClientDirectoryScreen} options={{ title: 'Directorio' }} />
      <Tab.Screen name="Calculadora" component={QuoteCalculatorScreen} options={{ title: 'Calculadora' }} />
    </Tab.Navigator>
  );
}

/** Pantallas de detalle apiladas sobre los tabs (Perfil 360°, Detalle de préstamo). */
export function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Tabs" component={Tabs} />
        <Stack.Screen name="Perfil" component={ClientProfileScreen} options={{ headerShown: true, title: 'Perfil' }} />
        <Stack.Screen
          name="DetallePrestamo"
          component={LoanDetailScreen}
          options={{ headerShown: true, title: 'Préstamo' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
