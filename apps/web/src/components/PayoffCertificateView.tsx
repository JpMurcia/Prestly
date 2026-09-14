import type { PayoffCertificateData } from '@repo/core';

export interface PayoffCertificateViewProps {
  data: PayoffCertificateData;
  /** Ya construido por quien llama (buildWhatsAppShareLink + buildPayoffCertificateMessage),
   * `null` si el cliente no tiene un teléfono utilizable — mismo patrón que el resto de las
   * acciones de compartir de esta app (specs/004-whatsapp-automation/). */
  shareLink: string | null;
  onClose: () => void;
}

/** Certificado de Paz y Salvo (specs/008-flexible-repayment-features/, US3) — vista imprimible/
 * compartible, sin persistencia (se genera bajo demanda cada vez, spec.md Assumptions). */
export function PayoffCertificateView({ data, shareLink, onClose }: PayoffCertificateViewProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6 print:static print:bg-transparent print:p-0">
      <div className="flex w-full max-w-md flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-8 text-center shadow-xl print:shadow-none">
        <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Certificado de Paz y Salvo</p>
        <h2 className="font-display text-xl font-extrabold text-brand-ink">{data.clientName}</h2>
        <p className="text-sm text-neutral-500">
          Certifica que el préstamo #{data.loanId.slice(0, 8)}, por {data.principalFormatted} en {data.installmentCount} cuotas,
          quedó completamente saldado.
        </p>
        <div className="rounded-lg bg-emerald-50 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Fecha de cierre</p>
          <p className="text-lg font-bold text-emerald-800">{data.closingDateFormatted}</p>
        </div>

        <div className="mt-2 flex flex-col gap-2">
          <a
            data-testid="payoff-certificate-share"
            href={shareLink ?? undefined}
            target="_blank"
            rel="noreferrer"
            aria-disabled={!shareLink}
            title={!shareLink ? 'Este cliente no tiene un teléfono utilizable' : undefined}
            onClick={(e) => {
              if (!shareLink) e.preventDefault();
            }}
            className={[
              'rounded-lg border border-neutral-200 px-4 py-2 text-sm font-bold',
              shareLink ? 'text-emerald-700 hover:bg-emerald-50' : 'cursor-not-allowed text-neutral-300',
            ].join(' ')}
          >
            Compartir por WhatsApp
          </a>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-bold text-brand-ink hover:bg-neutral-50"
          >
            Imprimir
          </button>
          <button type="button" onClick={onClose} className="text-xs font-semibold text-neutral-400 print:hidden">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
