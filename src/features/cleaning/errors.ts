import { ApiError } from '@/lib/api';
import { cleaningTexts } from './texts';

/**
 * Message affichable d'une erreur de la gateway : son message (déjà en français), suivi de la
 * référence de la requête quand le serveur est en cause (utile au support). Un 403 ou un 422 garde le
 * message de la gateway tel quel : c'est le backend qui explique pourquoi l'action est refusée.
 */
export function errorText(error: unknown): string {
  if (!(error instanceof ApiError)) return cleaningTexts.common.genericError;
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
