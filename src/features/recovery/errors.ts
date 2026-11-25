import { ApiError } from '@/lib/api';
import { recoveryTexts } from './texts';

const t = recoveryTexts.common;

/** Statut HTTP d'une erreur de la gateway (0 : coupure réseau), `null` pour une autre erreur. */
export const errorStatus = (error: unknown): number | null =>
  error instanceof ApiError ? error.status : null;

export const errorCode = (error: unknown): string | null => (error instanceof ApiError ? error.code : null);

/** Messages propres au front pour les refus métier dont la suite mérite d'être précisée. */
const KNOWN: Record<string, (error: ApiError) => string | null> = {
  RECOVERY_PRICING_RULE_INVALID: (error) => {
    const violations = error.details.violations;
    if (!Array.isArray(violations) || !violations.length) return null;
    const list = violations.filter((item): item is string => typeof item === 'string').join(' ; ');
    return `${error.message} À corriger : ${list}.`;
  },
  RECOVERY_PRICING_RULE_CONFLICT: (error) =>
    `${error.message} Archivez l’autre règle, ou changez la cible ou la période de celle-ci.`,
  RECOVERY_APPROVAL_BY_REQUESTER: () =>
    'Vous êtes l’auteur de cette demande (règle, paiement saisi) : sa validation revient à une autre personne.',
  RECOVERY_CONTACT_OUTSIDE_HOURS: (error) =>
    `${error.message} Les contacts manuels se font dans les plages autorisées (réglages du recouvrement).`,
  RECOVERY_NOT_IMPLEMENTED: () =>
    'Cette action n’est pas encore disponible : elle arrive avec la procédure contentieuse.',
};

/**
 * Message affichable d'une erreur de la gateway : message propre au front pour un refus métier connu,
 * sinon celui de la gateway (déjà en français), suivi de la référence quand le serveur est en cause.
 */
export function errorText(error: unknown): string {
  if (!(error instanceof ApiError)) return t.genericError;
  const known = KNOWN[error.code]?.(error);
  if (known) return known;
  const serverSide = error.status >= 500 || error.status === 0;
  return serverSide && error.correlationId
    ? `${error.message} ${t.reference(error.correlationId)}`
    : error.message;
}

/** Message d'une lecture en échec (écran entier) : avec la référence dès qu'elle est connue. */
export function loadErrorText(error: unknown): string {
  const message = errorText(error);
  if (!(error instanceof ApiError) || !error.correlationId || message.includes(error.correlationId)) {
    return message;
  }
  return `${message} ${t.reference(error.correlationId)}`;
}

/** Codes qui nomment le champ refusé (`details.field`, chemin du contrat : `tiers[1].upTo`). */
const FIELD_CODES = [
  'RECOVERY_VALIDATION_FAILED',
  'RECOVERY_SETTING_OUT_OF_BOUNDS',
  'GATEWAY_VALIDATION_FAILED',
];

/** Champ refusé par la gateway ou le service, avec son message ; `null` sinon. */
export function fieldError(error: unknown): { field: string; message: string } | null {
  if (!(error instanceof ApiError) || !FIELD_CODES.includes(error.code)) return null;
  const field = error.details.field;
  return typeof field === 'string' && field ? { field, message: error.message } : null;
}

/**
 * Erreur d'un formulaire : sous le champ concerné quand la gateway le nomme et que l'écran le connaît
 * (`fields`), sinon en tête du formulaire.
 */
export function placeError(
  error: unknown,
  fields: readonly string[],
): { field: string | null; message: string } {
  const refused = fieldError(error);
  if (refused) {
    const known = fields.find(
      (name) =>
        refused.field === name ||
        refused.field.startsWith(`${name}[`) ||
        refused.field.startsWith(`${name}.`),
    );
    if (known) return { field: refused.field, message: refused.message };
  }
  return { field: null, message: errorText(error) };
}

/** Exécute une action et renvoie `null` si elle a réussi, sinon le message à afficher (confirmations). */
export async function attempt(action: () => Promise<unknown>): Promise<string | null> {
  try {
    await action();
    return null;
  } catch (error) {
    return errorText(error);
  }
}
