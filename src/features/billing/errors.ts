import { ApiError, apiErrorText } from '@/lib/api';
import { billingTexts } from './texts';

const t = billingTexts.errors;

/** La fiche doit-elle être relue après ce refus (facture changée entre-temps) ? */
export function isStale(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.code === 'BILLING_INVALID_TRANSITION' || error.code === 'BILLING_CONCURRENT_UPDATE')
  );
}

/**
 * Message d'un refus du paiement manuel : raison précisée (`details.reason`) ou facture changée
 * entre-temps. Les autres erreurs gardent le message de la gateway.
 */
export function paymentErrorText(error: unknown, balance: string): string {
  if (error instanceof ApiError) {
    if (error.code === 'BILLING_PAYMENT_INVALID') {
      if (error.details.reason === 'exceeds_balance') return t.exceedsBalance(balance);
      if (error.details.reason === 'amount_invalid') return t.amountInvalid;
      if (error.details.reason === 'method_not_allowed') return t.methodNotAllowed;
    }
    if (error.code === 'BILLING_INVALID_TRANSITION') return t.invalidTransition;
    if (error.code === 'BILLING_CONCURRENT_UPDATE') return t.concurrent;
  }
  return apiErrorText(error);
}

/** Fiche introuvable (404) : rien à réessayer. */
export const isNotFound = (error: unknown) => error instanceof ApiError && error.status === 404;
