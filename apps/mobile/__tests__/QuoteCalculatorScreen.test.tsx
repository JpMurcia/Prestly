import { fireEvent, renderScreen, screen } from '../test-utils';
import { QuoteCalculatorScreen } from '../src/screens/QuoteCalculatorScreen';

/**
 * Cubre los escenarios de aceptación 1 y 2 de US1 (spec.md): recálculo instantáneo al
 * ajustar parámetros, y tabla completa cuyos totales coinciden con el resumen.
 *
 * Nota: @testing-library/react-native v14 hace `render`/`fireEvent` asíncronos.
 */
describe('QuoteCalculatorScreen', () => {
  it('recalcula cuota/interés/total al instante al cambiar el capital (escenario 1)', async () => {
    await renderScreen(<QuoteCalculatorScreen />);

    // Valores por defecto = caso de referencia de spec.md raíz §5.1.
    expect(screen.getByTestId('quote-total-to-pay')).toHaveTextContent('$575.00');
    expect(screen.getByTestId('quote-installment-amount')).toHaveTextContent('$47.92');

    await fireEvent.changeText(screen.getByTestId('quote-principal-input'), '1000');

    expect(screen.getByTestId('quote-total-to-pay')).toHaveTextContent('$1,150.00');
    expect(screen.getByTestId('quote-installment-amount')).toHaveTextContent('$95.83');
  });

  it('la tabla completa muestra N filas cuyos totales coinciden exactamente con el resumen (escenario 2)', async () => {
    await renderScreen(<QuoteCalculatorScreen />);

    await fireEvent.press(screen.getByTestId('quote-toggle-table'));

    for (let n = 1; n <= 12; n += 1) {
      expect(screen.getByTestId(`quote-installment-row-${n}`)).toBeTruthy();
    }

    expect(screen.getByTestId('quote-table-total-principal')).toHaveTextContent('$500.00');
    expect(screen.getByTestId('quote-table-total-interest')).toHaveTextContent('$75.00');
    expect(screen.getByTestId('quote-table-total-amount')).toHaveTextContent('$575.00');
  });
});
