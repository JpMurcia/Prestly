import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from './layout/AppShell';
import { ActiveLoansPage } from './pages/ActiveLoansPage';
import { ClientDirectoryPage } from './pages/ClientDirectoryPage';
import { ClientProfilePage } from './pages/ClientProfilePage';
import { DashboardPage } from './pages/DashboardPage';
import { LoanAmortizationPage } from './pages/LoanAmortizationPage';
import { QuoteCalculatorPage } from './pages/QuoteCalculatorPage';
import { SettingsPage } from './pages/SettingsPage';

/**
 * Rutas de nivel superior (spec.md, mockups 1c/2e: la barra de direcciones asume URLs
 * reales, ej. `app.microcreditos.io/prestamos/1042`). Cada historia de usuario registra su
 * página real en el elemento correspondiente (US1 → T028 ✓, US2 → T036 ✓, US3 → T043, US4 →
 * T047); hasta entonces el elemento es `null` (placeholder de Foundational).
 */
export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <DashboardPage /> },
      { path: '/prestamos', element: <ActiveLoansPage /> },
      { path: '/prestamos/:id', element: <LoanAmortizationPage /> },
      { path: '/clientes', element: <ClientDirectoryPage /> },
      { path: '/clientes/:id', element: <ClientProfilePage /> },
      { path: '/calculadora', element: <QuoteCalculatorPage /> },
      { path: '/configuracion', element: <SettingsPage /> },
    ],
  },
]);
