# Contrato: `@repo/core` — Automatización WhatsApp

## Tipos

```ts
export type WhatsAppNotificationType = 'reminder' | 'overdue';
export type WhatsAppNotificationResult = 'sent' | 'simulated' | 'failed';

export interface WhatsAppNotification {
  id: string;
  installmentId: string;
  clientId: string;
  type: WhatsAppNotificationType;
  result: WhatsAppNotificationResult;
  detail: string | null;
  createdAt: Date;
}

export interface WhatsAppConfigStatus {
  connected: boolean;
  fromNumber: string | null; // sin prefijo "whatsapp:", solo para mostrar en la UI
}
```

## Interfaces (DIP — implementadas en `packages/data-supabase`, consumidas por `apps/web`)

```ts
export interface IWhatsAppConfigRepository {
  getStatus(): Promise<WhatsAppConfigStatus>;
  saveCredentials(accountSid: string, authToken: string, fromNumber: string): Promise<void>;
  clearCredentials(): Promise<void>;
}

export interface IWhatsAppNotificationHistoryReader {
  list(): Promise<WhatsAppNotification[]>;
}
```

`apps/mobile` no consume estas dos interfaces — la configuración y el historial son solo de `apps/web` (ver Assumptions de spec.md / data-model.md).

## Funciones puras (consumidas por `apps/mobile` Y `apps/web` — Historia 3)

```ts
/** Quita todo excepto dígitos y un '+' inicial; null si el resultado no tiene entre 8 y 15 dígitos. */
export function normalizePhoneForWhatsApp(rawPhone: string): string | null;

/** https://wa.me/<dígitos>?text=<mensaje codificado>, o null si normalizePhoneForWhatsApp devuelve null. */
export function buildWhatsAppShareLink(rawPhone: string, message: string): string | null;

export function buildLoanShareMessage(params: {
  clientName: string;
  principalFormatted: string; // ya formateado por quien llama (formatMoney/formatCurrency de cada app)
  installmentCount: number;
  firstDueDateFormatted: string; // idem — @repo/core no formatea moneda/fecha, solo redacta
}): string;

export function buildReceiptMessage(params: {
  clientName: string;
  installmentNumber: number;
  installmentCount: number;
  amountReceivedFormatted: string;
  isFullyPaid: boolean;
  remainingBalanceFormatted?: string; // requerido si isFullyPaid = false
}): string;
```

Estas cuatro funciones son puras (sin I/O), mismo espíritu que `AmortizationCalculator` — un solo lugar para el formato del enlace y la redacción de los mensajes. La decisión de NO formatear moneda/fecha dentro de `@repo/core` (a diferencia de tomar `number`/`Date`) evita un tercer formateador de moneda independiente de `formatMoney` (mobile) y `formatCurrency` (web), que ya existen y ya son correctos — ambas apps ya tienen el formateador en alcance en cada punto de uso.
