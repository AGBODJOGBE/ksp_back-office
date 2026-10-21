import { ApiError, apiErrorFromResponse } from './errors';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestOptions {
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  /** false pour une route publique : aucun jeton n'est envoyé. */
  auth?: boolean;
  signal?: AbortSignal;
  /** Clé d'idempotence pour les écritures sensibles (paiement, commande). */
  idempotencyKey?: string;
  /** Options de cache Next.js, côté serveur uniquement. */
  next?: { revalidate?: number | false; tags?: string[] };
}

export interface ApiClientOptions {
  baseUrl: string;
  /** Envoie les cookies (jeton de renouvellement) : navigateur uniquement. */
  withCredentials: boolean;
  getAccessToken?: () => string | null;
  /** Renouvelle la session ; renvoie true si un nouveau jeton est disponible. */
  refreshSession?: () => Promise<boolean>;
  fetchImpl?: typeof fetch;
}

const API_PREFIX = '/api/v1/';

export interface ApiClient {
  request<T>(method: HttpMethod, path: string, options?: RequestOptions): Promise<T>;
  get<T>(path: string, options?: RequestOptions): Promise<T>;
  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T>;
  patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T>;
  delete<T>(path: string, options?: RequestOptions): Promise<T>;
}

/** En-tête de corrélation créé par la gateway pour chaque requête (exposé par sa politique CORS). */
const CORRELATION_HEADER = 'X-Correlation-Id';

/**
 * Client unique de la gateway. Le front n'appelle aucun autre serveur (règle d'architecture).
 * - l'identifiant de corrélation est créé par la gateway (une valeur envoyée par le client est ignorée,
 *   et l'en-tête n'est pas autorisé par sa politique CORS) : il est relu dans la réponse ;
 * - sur 401, la session est renouvelée une fois puis la requête est rejouée ;
 * - toute erreur est convertie en ApiError (message en français affichable).
 */
export function createApiClient(options: ApiClientOptions): ApiClient {
  const fetchImpl = options.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));

  function buildUrl(path: string, query?: RequestOptions['query']): string {
    if (!path.startsWith(API_PREFIX)) {
      throw new Error(`Chemin d'API invalide « ${path} » : il doit commencer par ${API_PREFIX}`);
    }
    const url = new URL(path, options.baseUrl);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
    return url.toString();
  }

  async function send<T>(method: HttpMethod, path: string, request: RequestOptions, canRetry: boolean) {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (request.body !== undefined) headers['Content-Type'] = 'application/json';
    if (request.idempotencyKey) headers['Idempotency-Key'] = request.idempotencyKey;
    const token = request.auth === false ? null : (options.getAccessToken?.() ?? null);
    if (token) headers.Authorization = `Bearer ${token}`;

    // Construite hors du try : un chemin invalide est une erreur de programmation, pas une coupure réseau.
    const url = buildUrl(path, request.query);
    let response: Response;
    try {
      response = await fetchImpl(url, {
        method,
        headers,
        body: request.body === undefined ? undefined : JSON.stringify(request.body),
        credentials: options.withCredentials ? 'include' : 'omit',
        signal: request.signal,
        ...(request.next ? { next: request.next } : {}),
      });
    } catch (error) {
      if ((error as Error).name === 'AbortError') throw error;
      throw ApiError.network();
    }

    if (response.status === 401 && canRetry && request.auth !== false && options.refreshSession) {
      if (await options.refreshSession()) return send<T>(method, path, request, false);
    }

    if (response.status === 204) return undefined as T;
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const correlationId = response.headers.get(CORRELATION_HEADER) ?? undefined;
      throw apiErrorFromResponse(response.status, body, correlationId);
    }
    return body as T;
  }

  const request = <T>(method: HttpMethod, path: string, requestOptions: RequestOptions = {}) =>
    send<T>(method, path, requestOptions, true);

  return {
    request,
    get: (path, requestOptions) => request('GET', path, requestOptions),
    post: (path, body, requestOptions) => request('POST', path, { ...requestOptions, body }),
    patch: (path, body, requestOptions) => request('PATCH', path, { ...requestOptions, body }),
    delete: (path, requestOptions) => request('DELETE', path, requestOptions),
  };
}
