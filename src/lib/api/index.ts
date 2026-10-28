import { publicEnv, serverApiUrl } from '@/config/env';
import { type ApiClient, createApiClient } from './client';
import { session } from './session';

export { ApiError } from './errors';
export type { ApiClient, RequestOptions } from './client';
export {
  session,
  useSession,
  type RestoreResult,
  type Session,
  type SessionEnd,
  type SessionPayload,
  type SessionUser,
} from './session';
export { sessionPayloadSchema, sessionUserSchema } from './session-schema';
export { parseResponse } from './validate';

/** Client à utiliser dans les composants du navigateur (jeton d'accès de la session, cookies inclus). */
export const api: ApiClient = createApiClient({
  baseUrl: publicEnv.apiUrl,
  withCredentials: true,
  getAccessToken: () => session.getAccessToken(),
  refreshSession: () => session.refresh(),
});

/**
 * Client à utiliser côté serveur (contenus publics rendus par Next.js).
 * Sans cookie ni jeton : uniquement les routes publiques de la gateway. Jamais pour une donnée d'agent.
 */
export function serverApi(): ApiClient {
  return createApiClient({ baseUrl: serverApiUrl(), withCredentials: false });
}
