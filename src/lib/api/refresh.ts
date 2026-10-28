import { publicEnv } from '@/config/env';
import { type ApiClient, createApiClient } from './client';
import { ApiError } from './errors';
import { type SessionPayload, sessionPayloadSchema } from './session-schema';
import { parseResponse } from './validate';

/**
 * Route de renouvellement de la gateway (contrat `ksp-api.v1.yaml`, opération `refreshSession`, F-015).
 * Côté navigateur, sans corps : le jeton de renouvellement est lu dans le cookie `__Secure-ksp_admin_rt`
 * (back-office), limité au chemin `/api/v1/identity/token`.
 */
export const SESSION_REFRESH_PATH = '/api/v1/identity/token/refresh';

/**
 * Statuts qui signifient « pas de session » : cookie absent, expiré (12 h atteintes, ou 30 min sans
 * renouvellement, ADR-023), révoqué. Un 403 (compte suspendu, plus aucun rôle du back-office) n'en
 * fait pas partie : il remonte, pour que l'écran l'explique au lieu de renvoyer à la connexion.
 */
const NO_SESSION_STATUSES = new Set([400, 401]);

/**
 * Renouvellement de session : nouvelle session, `null` s'il n'y en a pas, exception sinon (accès refusé,
 * réseau, limite d'appels, panne) — l'interface distingue ces cas.
 */
export function createSessionRefresher(client: ApiClient) {
  return async (): Promise<SessionPayload | null> => {
    try {
      // auth: false — aucun jeton d'accès, et surtout pas de renouvellement en boucle sur 401.
      const body = await client.post(SESSION_REFRESH_PATH, undefined, { auth: false });
      return parseResponse(sessionPayloadSchema, body);
    } catch (error) {
      if (error instanceof ApiError && NO_SESSION_STATUSES.has(error.status)) return null;
      throw error;
    }
  };
}

export const refreshSession = createSessionRefresher(
  createApiClient({ baseUrl: publicEnv.apiUrl, withCredentials: true }),
);
