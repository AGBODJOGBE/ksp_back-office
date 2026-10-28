import { sessionBody } from './session.test-utils';
import { createApiClient } from './client';
import { ApiError } from './errors';
import { createSessionRefresher, SESSION_REFRESH_PATH } from './refresh';

function setup(response: Response | Error) {
  const fetchImpl = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
    if (response instanceof Error) throw response;
    return response;
  });
  const refresh = createSessionRefresher(
    createApiClient({
      baseUrl: 'http://localhost:3005',
      withCredentials: true,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    }),
  );
  return { refresh, fetchImpl };
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const failure = (code: string) => ({ error: { code, message: 'Refusé.', details: {} } });

describe('renouvellement de la session du back-office', () => {
  it('appelle la route du contrat, sans corps ni jeton, avec le cookie', async () => {
    const { refresh, fetchImpl } = setup(json(200, sessionBody()));

    await expect(refresh()).resolves.toMatchObject({
      status: 'authenticated',
      sessionId: sessionBody().sessionId,
    });

    expect(SESSION_REFRESH_PATH).toBe('/api/v1/identity/token/refresh');
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(String(url)).toBe('http://localhost:3005/api/v1/identity/token/refresh');
    expect(init).toMatchObject({ method: 'POST', credentials: 'include', body: undefined });
    expect(init?.headers).not.toHaveProperty('Authorization');
  });

  it.each([400, 401])(
    'renvoie « pas de session » sur %i (absente, 12 h atteintes, 30 min sans activité)',
    async (status) => {
      await expect(
        setup(json(status, failure('IDENTITY_REFRESH_TOKEN_INVALID'))).refresh(),
      ).resolves.toBeNull();
    },
  );

  it('fait remonter un refus du back-office (403) pour l’expliquer', async () => {
    const error = await setup(json(403, failure('IDENTITY_BACKOFFICE_FORBIDDEN')))
      .refresh()
      .catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 403, code: 'IDENTITY_BACKOFFICE_FORBIDDEN' });
  });

  it('signale une panne plutôt qu’une absence de session', async () => {
    await expect(setup(new TypeError('Failed to fetch')).refresh()).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    });
    await expect(setup(json(503, failure('IDENTITY_UNAVAILABLE'))).refresh()).rejects.toMatchObject({
      status: 503,
    });
  });

  it('refuse une réponse hors contrat', async () => {
    const error = await setup(json(200, { accessToken: 'jeton' }))
      .refresh()
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: 'INVALID_RESPONSE' });
  });
});
