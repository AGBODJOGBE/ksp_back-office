/**
 * Gateway simulée pour les tests unitaires de la connexion : `fetch` remplacé, réponses au format du
 * contrat `ksp-api.v1.yaml`. Les requêtes reçues sont gardées pour vérifier ce que le front envoie.
 */

export type FakeResponse = { status: number; body?: unknown };
type Handler = FakeResponse | ((body: unknown) => FakeResponse);

export interface GatewayCall {
  method: string;
  path: string;
  body: unknown;
  headers: Record<string, string>;
}

export { accessToken, sessionBody, TEST_USER as USER } from '@/lib/api/session.test-utils';

export function challengeBody(resendAfterSeconds = 60) {
  return {
    challengeId: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d9e0f',
    maskedTarget: '+229********01',
    channel: 'whatsapp',
    expiresInSeconds: 300,
    resendAfterSeconds,
  };
}

export function mfaRequiredBody(enrollmentRequired: boolean) {
  return {
    status: 'mfa_required',
    mfaToken: 'mfa_2b3c4d5e6f',
    expiresAt: '2099-01-01T00:05:00Z',
    methods: ['totp', 'recovery_code'],
    enrollmentRequired,
  };
}

export const ENROLLMENT = {
  secret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
  otpauthUri:
    'otpauth://totp/KSP:%2B2290197000001?secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP&issuer=KSP&algorithm=SHA1&digits=6&period=30',
  issuer: 'KSP',
  accountName: '+2290197000001',
  digits: 6,
  periodSeconds: 30,
};

export const RECOVERY_CODES = [
  '7KQ2M-X9PDA',
  'H4TZ8-0RWNC',
  'B6VJE-3MYQ1',
  '2NDKS-QF7HX',
  'WP5CA-8ZT0G',
  'E9MRY-K2HVB',
  '1XGQT-6NWJD',
  'SZ3FP-YB8KM',
  '0CHVN-4ERT7',
  'Q8JWD-5AXPZ',
];

export function errorBody(code: string, message: string, details: Record<string, unknown> = {}) {
  return { error: { code, message, details, correlationId: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d9e12' } };
}

export const NO_SESSION: FakeResponse = {
  status: 401,
  body: errorBody('IDENTITY_REFRESH_TOKEN_INVALID', 'Votre session a expiré, reconnectez-vous.'),
};

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
    calls.push({
      method,
      path: url.pathname,
      body,
      headers: { ...(init.headers as Record<string, string>) },
    });

    const queue = queues.get(`${method} ${url.pathname}`);
    if (!queue?.length) throw new Error(`Route non simulée : ${method} ${url.pathname}`);
    const handler = (queue.length > 1 ? queue.shift() : queue[0]) as Handler;
    const response = typeof handler === 'function' ? handler(body) : handler;
    return new Response(response.body === undefined ? null : JSON.stringify(response.body), {
      status: response.status,
      headers: { 'Content-Type': 'application/json', 'X-Correlation-Id': 'c-test' },
    });
  });

  vi.stubGlobal('fetch', fetchMock);
  return { calls, fetchMock };
}
