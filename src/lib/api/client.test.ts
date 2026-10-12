import { createApiClient } from './client';
import { ApiError } from './errors';

const json = (status: number, body: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

function setup(
  responses: Array<Response | Error>,
  overrides: Partial<Parameters<typeof createApiClient>[0]> = {},
) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const next = responses.shift();
    if (!next) throw new Error('Aucune réponse prévue');
    if (next instanceof Error) throw next;
    return next;
  });
  const client = createApiClient({
    baseUrl: 'https://api.ksp.bj',
    withCredentials: true,
    fetchImpl: fetchImpl as unknown as typeof fetch,
    newCorrelationId: () => 'corr-1',
    ...overrides,
  });
  return { client, calls };
}

describe('client de la gateway', () => {
  it('appelle la gateway avec la corrélation, le jeton et les cookies', async () => {
    const { client, calls } = setup([json(200, { id: 'u1' })], { getAccessToken: () => 'jeton' });

    await expect(client.get('/api/v1/identity/me', { query: { page: 2, vide: undefined } })).resolves.toEqual(
      {
        id: 'u1',
      },
    );

    expect(calls[0]?.url).toBe('https://api.ksp.bj/api/v1/identity/me?page=2');
    expect(calls[0]?.init.headers).toMatchObject({
      'x-correlation-id': 'corr-1',
      Authorization: 'Bearer jeton',
    });
    expect(calls[0]?.init.credentials).toBe('include');
  });

  it("n'envoie pas de jeton sur une route publique", async () => {
    const { client, calls } = setup([json(200, [])], { getAccessToken: () => 'jeton' });
    await client.get('/api/v1/cms/pages', { auth: false });
    expect(calls[0]?.init.headers).not.toHaveProperty('Authorization');
  });

  it('envoie le corps en JSON et la clé d’idempotence', async () => {
    const { client, calls } = setup([json(201, { ok: true })]);
    await client.post('/api/v1/order/orders', { total: 15000 }, { idempotencyKey: 'cle-1' });
    expect(calls[0]?.init.body).toBe('{"total":15000}');
    expect(calls[0]?.init.headers).toMatchObject({
      'Content-Type': 'application/json',
      'Idempotency-Key': 'cle-1',
    });
  });

  it('convertit le format d’erreur commun en ApiError', async () => {
    const { client } = setup([
      json(422, {
        error: { code: 'IDENTITY_OTP_EXPIRED', message: 'Le code a expiré.', correlationId: 'c-9' },
      }),
    ]);
    const error = await client.post('/api/v1/identity/otp/verify').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 422, code: 'IDENTITY_OTP_EXPIRED', message: 'Le code a expiré.' });
    expect((error as ApiError).correlationId).toBe('c-9');
  });

  it('donne un message français quand la réponse n’a pas le format attendu', async () => {
    const { client } = setup([new Response('Bad Gateway', { status: 503 })]);
    await expect(client.get('/api/v1/catalog/products')).rejects.toMatchObject({
      code: 'HTTP_503',
      message: 'Service momentanément indisponible. Réessayez dans quelques instants.',
    });
  });

  it('signale une coupure réseau', async () => {
    const { client } = setup([new TypeError('Failed to fetch')]);
    await expect(client.get('/api/v1/catalog/products')).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      status: 0,
    });
  });

  it('renouvelle la session une fois sur 401 puis rejoue la requête', async () => {
    let token = 'ancien';
    const refreshSession = vi.fn(async () => {
      token = 'nouveau';
      return true;
    });
    const { client, calls } = setup([json(401, {}), json(200, { ok: true })], {
      getAccessToken: () => token,
      refreshSession,
    });

    await expect(client.get('/api/v1/identity/me')).resolves.toEqual({ ok: true });
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(calls[1]?.init.headers).toMatchObject({ Authorization: 'Bearer nouveau' });
  });

  it('ne boucle pas si la session ne peut pas être renouvelée', async () => {
    const { client } = setup([json(401, {})], { refreshSession: async () => false });
    await expect(client.get('/api/v1/identity/me')).rejects.toMatchObject({ status: 401 });
  });

  it('refuse un chemin hors de la gateway', async () => {
    const { client } = setup([]);
    await expect(client.get('https://autre-site.com/api')).rejects.toThrow('Chemin d');
  });

  it('accepte une réponse vide (204)', async () => {
    const { client } = setup([new Response(null, { status: 204 })]);
    await expect(client.delete('/api/v1/identity/sessions/s1')).resolves.toBeUndefined();
  });
});
