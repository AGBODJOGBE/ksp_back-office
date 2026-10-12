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
  newCorrelationId?: () => string;
}

const API_PREFIX = '/api/v1/';

export interface ApiClient {
  request<T>(method: HttpMethod, path: string, options?: RequestOptions): Promise<T>;
  get<T>(path: string, options?: RequestOptions): Promise<T>;
  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T>;
  patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T>;
  delete<T>(path: string, options?: RequestOptions): Promise<T>;
}

/**
 * Client unique de la gateway. Le front n'appelle aucun autre serveur (règle d'architecture).
 * - chaque requête porte un identifiant de corrélation (suivi de bout en bout) ;
 * - sur 401, la session est renouvelée une fois puis la requête est rejouée ;
 * - toute erreur est convertie en ApiError (message en français affichable).
 */
export function createApiClient(options: ApiClientOptions): ApiClient {
  const fetchImpl = options.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const newCorrelationId = options.newCorrelationId ?? (() => crypto.randomUUID());

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
    const correlationId = newCorrelationId();
    const headers: Record<string, string> = { Accept: 'application/json', 'x-correlation-id': correlationId };
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
      throw ApiError.network(correlationId);
    }

    if (response.status === 401 && canRetry && request.auth !== false && options.refreshSession) {
      if (await options.refreshSession()) return send<T>(method, path, request, false);
    }

    if (response.status === 204) return undefined as T;
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) throw apiErrorFromResponse(response.status, body, correlationId);
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
