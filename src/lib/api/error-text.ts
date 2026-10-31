import { ApiError } from './errors';

const GENERIC = 'Une erreur est survenue. Réessayez dans quelques instants.';

/**
 * Message affichable d'une erreur de la gateway : son message (déjà en français), suivi de la
 * référence de la requête quand le serveur est en cause (utile au support). Un 403 ou un 422 garde le
 * message de la gateway. Une erreur qui ne vient pas de la gateway donne un message générique.
 */
export function apiErrorText(error: unknown): string {
  if (!(error instanceof ApiError)) return GENERIC;
  const serverSide = error.status >= 500 || error.status === 0;
  return serverSide && error.correlationId
    ? `${error.message} Référence pour le support : ${error.correlationId}.`
    : error.message;
}
