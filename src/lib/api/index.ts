import { publicEnv, serverApiUrl } from '@/config/env';
import { type ApiClient, createApiClient } from './client';
import { createSessionStore, SESSION_REFRESH_PATH, type SessionTokens } from './session';

export { ApiError } from './errors';
export type { ApiClient, RequestOptions } from './client';

/** Session du navigateur (jeton d'accès en mémoire). */
export const session = createSessionStore({
  refresh: async () => {
    const response = await fetch(new URL(SESSION_REFRESH_PATH, publicEnv.apiUrl), {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json', 'x-correlation-id': crypto.randomUUID() },
    });
    return response.ok ? ((await response.json()) as SessionTokens) : null;
  },
});

/** Client à utiliser dans les composants du navigateur. */
export const api: ApiClient = createApiClient({
  baseUrl: publicEnv.apiUrl,
  withCredentials: true,
  getAccessToken: () => session.getAccessToken(),
  refreshSession: () => session.refresh(),
});

/**
 * Client à utiliser côté serveur (pages publiques rendues par Next.js, contenus du CMS).
 * Sans cookie ni jeton : uniquement les routes publiques de la gateway.
 */
export function serverApi(): ApiClient {
  return createApiClient({ baseUrl: serverApiUrl(), withCredentials: false });
}
