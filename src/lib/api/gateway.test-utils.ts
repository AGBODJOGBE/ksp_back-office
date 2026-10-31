/**
 * Gateway simulée pour les tests des écrans : `fetch` remplacé, réponses au format du contrat
 * `ksp-api.v1.yaml`. Les requêtes reçues sont gardées pour vérifier ce que le front envoie (chemin,
 * requête, corps, en-têtes).
 */

export type FakeResponse = { status: number; body?: unknown };
type Handler = FakeResponse | ((body: unknown, url: URL) => FakeResponse);

export interface GatewayCall {
  method: string;
  path: string;
  search: string;
  body: unknown;
  headers: Record<string, string>;
}

export const xof = (amount: number) => ({ amount, currency: 'XOF' });

/** Corps d'erreur de la gateway (`ErrorResponse`). */
export function errorBody(code: string, message: string, details: Record<string, unknown> = {}) {
  return { error: { code, message, details, correlationId: 'c-test' } };
}

/**
 * Remplace `fetch`. `routes` associe « MÉTHODE /chemin » à une réponse, ou à une liste de réponses
 * données dans l'ordre (la dernière est répétée).
 */
export function stubGateway(routes: Record<string, Handler | Handler[]>) {
  const calls: GatewayCall[] = [];
  const queues = new Map(Object.entries(routes).map(([key, value]) => [key, [value].flat()]));
  const fetchMock = vi.fn(async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const method = init.method ?? 'GET';
    const body = typeof init.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined;
    const headers = { ...(init.headers as Record<string, string> | undefined) };
    calls.push({ method, path: url.pathname, search: url.search, body, headers });
    const queue = queues.get(`${method} ${url.pathname}`);
    if (!queue?.length) throw new Error(`Route non simulée : ${method} ${url.pathname}`);
    const handler = (queue.length > 1 ? queue.shift() : queue[0]) as Handler;
    const response = typeof handler === 'function' ? handler(body, url) : handler;
    return new Response(response.body === undefined ? null : JSON.stringify(response.body), {
      status: response.status,
      headers: { 'Content-Type': 'application/json', 'X-Correlation-Id': 'c-test' },
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return { calls, fetchMock };
}
