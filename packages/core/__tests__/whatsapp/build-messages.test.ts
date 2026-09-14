import { buildLoanShareMessage, buildPayoffCertificateMessage, buildReceiptMessage } from '../../src/whatsapp/buildMessages';

describe('buildLoanShareMessage — specs/004-whatsapp-automation, Historia 3', () => {
  it('redacta el mensaje de tabla compartida con los datos ya formateados por el caller', () => {
    const message = buildLoanShareMessage({
      clientName: 'Ana Pérez',
      principalFormatted: '500.00',
      installmentCount: 12,
      firstDueDateFormatted: '10/09/2026',
    });

    expect(message).toContain('Ana Pérez');
    expect(message).toContain('$500.00');
    expect(message).toContain('12 cuotas');
    expect(message).toContain('10/09/2026');
  });
});

describe('buildReceiptMessage — specs/004-whatsapp-automation, Historia 3', () => {
  it('redacta el comprobante de una cuota que quedó pagada por completo', () => {
    const message = buildReceiptMessage({
      clientName: 'Ana Pérez',
      installmentNumber: 3,
      installmentCount: 12,
      amountReceivedFormatted: '47.92',
      isFullyPaid: true,
    });

    expect(message).toContain('$47.92');
    expect(message).toContain('cuota 3 de 12');
    expect(message).toContain('pagada por completo');
    expect(message).not.toContain('pendientes');
  });

  it('redacta el comprobante de un pago parcial, incluyendo el saldo restante', () => {
    const message = buildReceiptMessage({
      clientName: 'Ana Pérez',
      installmentNumber: 3,
      installmentCount: 12,
      amountReceivedFormatted: '20.00',
      isFullyPaid: false,
      remainingBalanceFormatted: '27.92',
    });

    expect(message).toContain('$20.00');
    expect(message).toContain('$27.92');
    expect(message).toContain('pendientes');
  });
});

describe('buildPayoffCertificateMessage — specs/008-flexible-repayment-features, US3', () => {
  it('redacta el mensaje del Paz y Salvo sin duplicar el símbolo de moneda (encontrado en verificación manual: "$$ 500")', () => {
    const message = buildPayoffCertificateMessage({
      clientName: 'Ana Pérez',
      loanId: 'loan-1',
      principalFormatted: '$ 500',
      installmentCount: 12,
      closingDateFormatted: '14/9/2026',
    });

    expect(message).toContain('$ 500');
    expect(message).not.toContain('$$');
    expect(message).toContain('Ana Pérez');
    expect(message).toContain('12 cuotas');
    expect(message).toContain('14/9/2026');
    expect(message).toContain('Paz y Salvo');
  });
});
