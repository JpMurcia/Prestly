import { fireEvent, renderScreen, screen } from '../test-utils';
import { QuoteCalculatorScreen } from '../src/screens/QuoteCalculatorScreen';
import { appSettingsRepository, clientRepository } from '../src/data/repositories';

jest.mock('../src/data/repositories', () => ({
  clientRepository: { findById: jest.fn(), list: jest.fn(), findByPhone: jest.fn(), create: jest.fn() },
  loanRepository: { save: jest.fn() },
  appSettingsRepository: { getSettings: jest.fn() },
  authRepository: {
    getSession: jest.fn().mockResolvedValue({ userId: 'u1', email: 'admin@prestly.local' }),
    onSessionChange: jest.fn().mockReturnValue(() => {}),
    signOut: jest.fn().mockResolvedValue(undefined),
  },
}));

beforeEach(() => {
  (appSettingsRepository.getSettings as jest.Mock).mockResolvedValue({ currency: 'COP' });
  (clientRepository.findById as jest.Mock).mockResolvedValue(null);
});

// Intl usa U+00A0 (espacio de no separacion) entre el simbolo y la cifra en es-CO.
const NBSP = ' ';

function route() {
  return { params: undefined, key: 'Calculadora-1', name: 'Calculadora' as const };
}

/**
 * Cubre los escenarios de aceptación 1 y 2 de US1 (spec.md): recálculo instantáneo al
 * ajustar parámetros, y tabla completa cuyos totales coinciden con el resumen. Los valores
 * esperados están en pesos colombianos (COP, moneda por defecto — specs/006-rebrand-currency-polish/, US1).
 *
 * Nota: @testing-library/react-native v14 hace `render`/`fireEvent` asíncronos.
 */
describe('QuoteCalculatorScreen', () => {
  afterEach(() => jest.clearAllMocks());

  it('recalcula cuota/interés/total al instante al cambiar el capital (escenario 1)', async () => {
    await renderScreen(<QuoteCalculatorScreen route={route() as never} navigation={{} as never} />);

    // Valores por defecto = caso de referencia de spec.md raíz §5.1, redondeados a COP (sin decimales).
    expect(screen.getByTestId('quote-total-to-pay')).toHaveTextContent(`$${NBSP}575`);
    expect(screen.getByTestId('quote-installment-amount')).toHaveTextContent(`$${NBSP}48`);

    await fireEvent.changeText(screen.getByTestId('quote-principal-input'), '1000');

    expect(screen.getByTestId('quote-total-to-pay')).toHaveTextContent(`$${NBSP}1.150`);
    expect(screen.getByTestId('quote-installment-amount')).toHaveTextContent(`$${NBSP}96`);
  });

  it('la tabla completa muestra N filas cuyos totales coinciden exactamente con el resumen (escenario 2)', async () => {
    await renderScreen(<QuoteCalculatorScreen route={route() as never} navigation={{} as never} />);

    await fireEvent.press(screen.getByText('Ver tabla completa'));

    for (let n = 1; n <= 12; n += 1) {
      expect(screen.getByTestId(`quote-installment-row-${n}`)).toBeTruthy();
    }

    expect(screen.getByTestId('quote-table-total-principal')).toHaveTextContent(`$${NBSP}500`);
    expect(screen.getByTestId('quote-table-total-interest')).toHaveTextContent(`$${NBSP}75`);
    expect(screen.getByTestId('quote-table-total-amount')).toHaveTextContent(`$${NBSP}575`);
  });
});
