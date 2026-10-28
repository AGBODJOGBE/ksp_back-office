import { accessToken } from './session.test-utils';
import { ApiError } from './errors';
import { createSessionStore, type SessionPayload } from './session';

const NOW = Date.parse('2026-10-21T10:00:00Z');

function payloadOf(token: string, accessTokenExpiresAt = '2026-10-21T10:15:00Z'): SessionPayload {
  return {
    status: 'authenticated',
    accessToken: token,
    accessTokenExpiresAt,
    refreshTokenExpiresAt: '2026-10-21T22:00:00Z',
    sessionId: 's1',
    user: {
      id: 'u1',
      status: 'active',
      firstName: 'Koffi',
      lastName: 'Adjovi',
      phone: '+2290197000001',
      email: null,
      emailVerified: false,
      preferredLanguage: 'fr',
      createdAt: '2026-10-21T09:00:00Z',
    },
    profileIncomplete: false,
  };
}

describe('session du back-office', () => {
  it('garde le jeton d’accès jusqu’à 30 s avant son expiration', () => {
    let clock = NOW;
    const store = createSessionStore({ refresh: async () => null, now: () => clock });

    store.set(payloadOf('jeton'));
    clock = NOW + 14 * 60_000 + 29_000;
    expect(store.getAccessToken()).toBe('jeton');
    clock = NOW + 14 * 60_000 + 31_000;
    expect(store.getAccessToken()).toBeNull();
    expect(store.get()?.accessToken).toBe('jeton');
  });

  it('garde le jeton si l’horloge du poste le voit déjà expiré (la gateway tranchera)', () => {
    const store = createSessionStore({ refresh: async () => null, now: () => NOW + 3_600_000 });
    store.set(payloadOf('jeton'));
    expect(store.getAccessToken()).toBe('jeton');
  });

  it('lit les rôles du jeton d’accès pour le menu', () => {
    const store = createSessionStore({ refresh: async () => null, now: () => NOW });
    store.set(payloadOf(accessToken(['cleaning_admin', 'finance_officer', 'cleaning_admin'])));
    expect(store.get()?.roles).toEqual(['cleaning_admin', 'finance_officer']);
    store.set(payloadOf('illisible'));
    expect(store.get()?.roles).toEqual([]);
  });

  it('ne lance qu’un renouvellement quand plusieurs requêtes le demandent', async () => {
    const refresh = vi.fn(async () => payloadOf('nouveau'));
    const store = createSessionStore({ refresh, now: () => NOW });

    const results = await Promise.all([store.refresh(), store.refresh(), store.refresh()]);

    expect(results).toEqual([true, true, true]);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(store.getAccessToken()).toBe('nouveau');
  });

  it('reprend la session : mémoire, gateway, absence, refus ou panne', async () => {
    const memory = createSessionStore({ refresh: vi.fn(), now: () => NOW });
    memory.set(payloadOf('a'));
    await expect(memory.restore()).resolves.toMatchObject({ status: 'authenticated' });

    const renewed = createSessionStore({ refresh: async () => payloadOf('b'), now: () => NOW });
    await expect(renewed.restore()).resolves.toMatchObject({
      status: 'authenticated',
      session: { accessToken: 'b' },
    });

    const anonymous = createSessionStore({ refresh: async () => null, now: () => NOW });
    await expect(anonymous.restore()).resolves.toEqual({ status: 'anonymous' });
    expect(anonymous.ended()).toBeNull();

    const denied = new ApiError(403, 'IDENTITY_BACKOFFICE_FORBIDDEN', 'Accès refusé.');
    const forbidden = createSessionStore({
      refresh: async () => {
        throw denied;
      },
      now: () => NOW,
    });
    await expect(forbidden.restore()).resolves.toEqual({ status: 'forbidden', error: denied });
    expect(forbidden.ended()).toEqual({ reason: 'forbidden', error: denied });

    const failure = new Error('réseau');
    const down = createSessionStore({
      refresh: async () => {
        throw failure;
      },
      now: () => NOW,
    });
    await expect(down.restore()).resolves.toEqual({ status: 'unavailable', error: failure });
  });

  it('note la fin de session : expiration pendant la visite, puis déconnexion', async () => {
    const store = createSessionStore({ refresh: async () => null, now: () => NOW });
    store.set(payloadOf('a'));
    await expect(store.refresh()).resolves.toBe(false);
    expect(store.get()).toBeNull();
    expect(store.ended()).toEqual({ reason: 'expired' });

    store.set(payloadOf('b'));
    expect(store.ended()).toBeNull();
    store.clear('logout');
    expect(store.ended()).toEqual({ reason: 'logout' });
  });

  it('prévient les abonnés des changements de session', () => {
    const store = createSessionStore({ refresh: async () => null, now: () => NOW });
    const seen: Array<string | null> = [];
    const unsubscribe = store.subscribe((current) => seen.push(current?.accessToken ?? null));

    store.set(payloadOf('a'));
    store.clear();
    unsubscribe();
    store.set(payloadOf('b'));

    expect(seen).toEqual(['a', null]);
  });
});
