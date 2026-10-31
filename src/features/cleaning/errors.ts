import { ApiError } from '@/lib/api';
import { formatDate, formatDateTime, formatXof } from '@/lib/format';
import { cleaningTexts } from './texts';

const t = cleaningTexts.errors;

const isoDate = (value: unknown): value is string =>
  typeof value === 'string' && !Number.isNaN(new Date(value).getTime());

/** `details.remainingDue` du refus d'un paiement au-delà du dû (`Money`, entiers de FCFA). */
function remainingDue(details: Record<string, unknown>): number | null {
  const due = details.remainingDue;
  if (!due || typeof due !== 'object') return null;
  const amount = (due as { amount?: unknown }).amount;
  return typeof amount === 'number' && Number.isInteger(amount) && amount >= 0 ? amount : null;
}

/**
 * Message propre au front pour les refus du Nettoyage dont les détails servent à l'agent (date prévue,
 * reste dû). Sans détail exploitable, le message de la gateway est gardé.
 */
function knownError(error: ApiError): string | null {
  const { details } = error;
  switch (error.code) {
    case 'CLEANING_INTERVENTION_TOO_EARLY':
      // `scheduledDate` : jour prévu à l'heure du Bénin (AAAA-MM-JJ) ; midi évite tout glissement de jour.
      return typeof details.scheduledDate === 'string' && isoDate(`${details.scheduledDate}T12:00:00+01:00`)
        ? t.interventionTooEarly(formatDate(`${details.scheduledDate}T12:00:00+01:00`))
        : null;
    case 'CLEANING_VISIT_TOO_EARLY':
      return isoDate(details.scheduledAt) ? t.visitTooEarly(formatDateTime(details.scheduledAt)) : null;
    case 'CLEANING_PAYMENT_INVALID': {
      const due = remainingDue(details);
      if (due === null) return null;
      return due > 0 ? t.paymentExceeds(formatXof(due)) : t.paymentSettled;
    }
    case 'CLEANING_ORGANIZATION_SUSPENDED':
      return t.organizationSuspended;
    default:
      return null;
  }
}

/**
 * Message affichable d'une erreur de la gateway : son message (déjà en français), suivi de la
 * référence de la requête quand le serveur est en cause (utile au support). Un 403 ou un 422 garde le
 * message de la gateway, sauf pour les refus dont les détails précisent la suite (`knownError`).
 */
export function errorText(error: unknown): string {
  if (!(error instanceof ApiError)) return cleaningTexts.common.genericError;
  const known = knownError(error);
  if (known) return known;
  const serverSide = error.status >= 500 || error.status === 0;
  return serverSide && error.correlationId
    ? `${error.message} ${cleaningTexts.common.reference(error.correlationId)}`
    : error.message;
}

/** Exécute une action et renvoie `null` si elle a réussi, sinon le message à afficher (boîtes de confirmation). */
export async function attempt(action: () => Promise<unknown>): Promise<string | null> {
  try {
    await action();
    return null;
  } catch (error) {
    return errorText(error);
  }
}
