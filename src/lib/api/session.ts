/**
 * Session côté navigateur.
 *
 * - Le jeton d'accès (court) reste en mémoire : jamais dans localStorage, inaccessible après fermeture.
 * - Le jeton de renouvellement est dans un cookie sécurisé posé par la gateway sur le domaine ksp.bj,
 *   illisible par le JavaScript et partagé entre ksp.bj, shop.ksp.bj et print.ksp.bj (un seul compte).
 * - Au chargement d'une page, ou sur une réponse 401, le jeton d'accès est redemandé à la gateway.
 */

/** Route de renouvellement de la gateway (contrat ksp-api.v1.yaml, décision F-015). */
export const SESSION_REFRESH_PATH = '/api/v1/identity/token/refresh';

export interface SessionTokens {
  accessToken: string;
  /** Durée de validité en secondes. */
  expiresIn: number;
}

type Listener = (accessToken: string | null) => void;

export function createSessionStore(options: {
  refresh: () => Promise<SessionTokens | null>;
  now?: () => number;
}) {
  const now = options.now ?? (() => Date.now());
  let accessToken: string | null = null;
  let expiresAt = 0;
  let pending: Promise<boolean> | null = null;
  const listeners = new Set<Listener>();

  const notify = () => listeners.forEach((listener) => listener(accessToken));

  function set(tokens: SessionTokens | null): void {
    accessToken = tokens?.accessToken ?? null;
    // Marge de 30 s : on renouvelle un peu avant l'expiration réelle.
    expiresAt = tokens ? now() + Math.max(0, tokens.expiresIn - 30) * 1000 : 0;
    notify();
  }

  return {
    getAccessToken(): string | null {
      return accessToken && now() < expiresAt ? accessToken : null;
    },
    set,
    clear: () => set(null),
    /** Un seul renouvellement à la fois, même si plusieurs requêtes reçoivent 401 en même temps. */
    refresh(): Promise<boolean> {
      pending ??= options
        .refresh()
        .then((tokens) => {
          set(tokens);
          return tokens !== null;
        })
        .catch(() => {
          set(null);
          return false;
        })
        .finally(() => {
          pending = null;
        });
      return pending;
    },
    subscribe(listener: Listener): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export type SessionStore = ReturnType<typeof createSessionStore>;
