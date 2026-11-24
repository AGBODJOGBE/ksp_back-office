import { ApiError } from '@/lib/api';
import { cleaningTexts } from './texts';

const t = cleaningTexts.common;

/** Raisons de `CLEANING_TARIFF_INCOMPLETE` (R-CA-11), avec le rang de l'élément (`details.index`). */
const TARIFF_INCOMPLETE: Record<string, (rank: string) => string> = {
  brackets_overlap: (rank) => `La tranche ${rank} chevauche la précédente : elle doit commencer juste après.`,
  brackets_gap: (rank) =>
    rank
      ? `Il manque des valeurs avant la tranche ${rank} : elle doit commencer juste après la précédente.`
      : 'Ajoutez au moins une tranche avant de publier.',
  first_bracket_above_min: () => 'La première tranche doit commencer à la borne basse du paramètre de base.',
  base_not_number: () => 'Le paramètre de base doit être un nombre.',
  base_inactive: () => 'Le paramètre de base est désactivé.',
  base_not_asked: () => 'Le paramètre de base n’est demandé ni par le lieu ni par l’offre.',
  supplement_parameter_not_asked: (rank) =>
    `Supplément ${rank} : son paramètre n’est demandé ni par le lieu ni par l’offre.`,
  unknown_choice: (rank) => `Supplément ${rank} : la valeur choisie n’existe pas pour ce paramètre.`,
  mode_incompatible: (rank) => `Supplément ${rank} : « par unité » ne s’applique qu’à un paramètre nombre.`,
};

/** Message propre au front quand les détails d'un refus précisent la suite ; sinon `null`. */
function knownError(error: ApiError): string | null {
  const { details } = error;
  if (error.code === 'CLEANING_TARIFF_INCOMPLETE' && typeof details.reason === 'string') {
    const describe = TARIFF_INCOMPLETE[details.reason];
    const rank = typeof details.index === 'number' ? `n° ${details.index + 1}` : '';
    return describe ? describe(rank) : null;
  }
  return null;
}

/**
 * Message affichable d'une erreur de la gateway : son message (déjà en français), suivi de la
 * référence de la requête quand le serveur est en cause. Une erreur qui ne vient pas de la gateway
 * donne un message générique.
 */
export function errorText(error: unknown): string {
  if (!(error instanceof ApiError)) return t.genericError;
  const known = knownError(error);
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

/** Statut HTTP d'une erreur de la gateway (0 : coupure réseau), `null` pour une autre erreur. */
export const errorStatus = (error: unknown): number | null =>
  error instanceof ApiError ? error.status : null;

export const errorCode = (error: unknown): string | null => (error instanceof ApiError ? error.code : null);

/**
 * Champ refusé par `CLEANING_VALIDATION_FAILED` (`details.field`, au chemin du contrat :
 * `brackets[2].to`, `teamRule[0]`, `visitFee`), avec le message de la gateway ; `null` sinon.
 */
export function fieldError(error: unknown): { field: string; message: string } | null {
  if (!(error instanceof ApiError) || error.code !== 'CLEANING_VALIDATION_FAILED') return null;
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

/** Exécute une action et renvoie `null` si elle a réussi, sinon le message à afficher (boîtes de confirmation). */
export async function attempt(action: () => Promise<unknown>): Promise<string | null> {
  try {
    await action();
    return null;
  } catch (error) {
    return errorText(error);
  }
}
