import type * as z from 'zod/mini';
import { ApiError } from './errors';

/**
 * Valide une réponse de la gateway avec son schéma (validation à la frontière). Une réponse hors
 * contrat devient une ApiError affichable plutôt qu'une erreur zod technique.
 */
export function parseResponse<S extends z.ZodMiniType>(schema: S, body: unknown): z.infer<S> {
  const result = schema.safeParse(body);
  if (!result.success) throw ApiError.invalidResponse();
  return result.data;
}
