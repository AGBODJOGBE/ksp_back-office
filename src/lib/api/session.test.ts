import { createSessionStore } from './session';

describe('session du navigateur', () => {
  it('garde le jeton d’accès jusqu’à 30 s avant son expiration', () => {
    let clock = 0;
    const store = createSessionStore({ refresh: async () => null, now: () => clock });

    store.set({ accessToken: 'jeton', expiresIn: 300 });
    clock = 269_000;
    expect(store.getAccessToken()).toBe('jeton');
    clock = 271_000;
    expect(store.getAccessToken()).toBeNull();
  });

  it('ne lance qu’un renouvellement quand plusieurs requêtes le demandent', async () => {
    const refresh = vi.fn(async () => ({ accessToken: 'nouveau', expiresIn: 300 }));
    const store = createSessionStore({ refresh });

    const results = await Promise.all([store.refresh(), store.refresh(), store.refresh()]);

    expect(results).toEqual([true, true, true]);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(store.getAccessToken()).toBe('nouveau');
  });

  it('vide la session si le renouvellement échoue', async () => {
    const store = createSessionStore({
      refresh: async () => {
        throw new Error('réseau');
      },
    });
    store.set({ accessToken: 'ancien', expiresIn: 300 });

    await expect(store.refresh()).resolves.toBe(false);
    expect(store.getAccessToken()).toBeNull();
  });

  it('prévient les abonnés des changements de session', () => {
    const store = createSessionStore({ refresh: async () => null });
    const seen: Array<string | null> = [];
    const unsubscribe = store.subscribe((token) => seen.push(token));

    store.set({ accessToken: 'a', expiresIn: 300 });
    store.clear();
    unsubscribe();
    store.set({ accessToken: 'b', expiresIn: 300 });

    expect(seen).toEqual(['a', null]);
  });
});
