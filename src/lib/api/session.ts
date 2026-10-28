import { useSyncExternalStore } from 'react';
import { rolesFromAccessToken } from './claims';
import { ApiError } from './errors';
import type { SessionPayload } from './session-schema';

/**
 * Session du back-office, côté navigateur (F-005, ADR-023).
 *
 * - Le jeton d'accès (15 minutes) reste en mémoire : jamais dans localStorage ni sessionStorage, perdu
 *   à la fermeture de l'onglet ou au rechargement de la page.
 * - Le jeton de renouvellement est dans le cookie HttpOnly `__Secure-ksp_admin_rt` posé par la gateway,
 *   illisible par le JavaScript.
 * - Au chargement d'une page de l'espace, ou sur une réponse 401, la session est redemandée à la gateway.
 *
 * Durée (ADR-023) : 12 heures au plus, et fermée après 30 minutes sans renouvellement. Le front ne
 * renouvelle **pas** la session sur une minuterie : il le fait seulement quand l'agent agit (chargement
 * d'une page, requête refusée faute de jeton valide). Une minuterie garderait ouverte la session d'un
 * poste laissé sans surveillance, ce que la fermeture après 30 minutes doit justement empêcher.
 *
 * Ce module n'importe ni la configuration ni zod : le menu le lit sur toutes les pages sans alourdir leur
 * JavaScript. Le renouvellement réel (`./refresh`) n'est chargé qu'au premier besoin.
 */

export type { SessionPayload, SessionUser } from './session-schema';

/** Session en mémoire : réponse de la gateway, plus les rôles lus dans le jeton d'accès (affichage). */
export type Session = SessionPayload & {
  /** Rôles du jeton d'accès : filtrent le menu, ne protègent rien (la gateway reste seule juge). */
  roles: readonly string[];
};

/** Issue d'une tentative de reprise de session. */
export type RestoreResult =
  | { status: 'authenticated'; session: Session }
  /** Aucune session valide (absente, expirée, révoquée) : il faut se connecter. */
  | { status: 'anonymous' }
  /** La gateway refuse la session (403) : compte suspendu, ou plus aucun rôle du back-office. */
  | { status: 'forbidden'; error: ApiError }
  /** La gateway n'a pas pu répondre (réseau, limite, panne) : on ne sait pas. */
  | { status: 'unavailable'; error: unknown };

/** Pourquoi la session en mémoire a pris fin (affiché par la garde des pages). */
export type SessionEnd =
  | { reason: 'logout' }
  | { reason: 'expired' }
  | { reason: 'forbidden'; error: ApiError }
  | { reason: 'unavailable'; error: unknown };

type Listener = (session: Session | null) => void;

/** On renouvelle un peu avant l'expiration réelle du jeton d'accès. */
const EXPIRY_MARGIN_MS = 30_000;

/**
 * Instant (horloge locale) à partir duquel le jeton n'est plus envoyé. Si l'horloge du poste avance au
 * point de voir le jeton déjà expiré, on le garde : la gateway répondra 401 et la session sera
 * renouvelée à ce moment-là, plutôt que de boucler sur des renouvellements inutiles.
 */
function expiryOf(isoDate: string, now: number): number {
  const expiresAt = Date.parse(isoDate) - EXPIRY_MARGIN_MS;
  return Number.isFinite(expiresAt) && expiresAt > now ? expiresAt : Number.POSITIVE_INFINITY;
}

function toResult(error: unknown): RestoreResult {
  return error instanceof ApiError && error.status === 403
    ? { status: 'forbidden', error }
    : { status: 'unavailable', error };
}

export function createSessionStore(options: {
  /** Demande une nouvelle session : `null` si aucune session valide, exception si la gateway refuse ou ne répond pas. */
  refresh: () => Promise<SessionPayload | null>;
  now?: () => number;
}) {
  const now = options.now ?? (() => Date.now());
  let current: Session | null = null;
  let ended: SessionEnd | null = null;
  let expiresAt = 0;
  let pending: Promise<RestoreResult> | null = null;
  const listeners = new Set<Listener>();

  function store(next: Session | null, end: SessionEnd | null): void {
    current = next;
    ended = next ? null : end;
    expiresAt = next ? expiryOf(next.accessTokenExpiresAt, now()) : 0;
    listeners.forEach((listener) => listener(current));
  }

  function set(payload: SessionPayload | null): void {
    store(payload ? { ...payload, roles: rolesFromAccessToken(payload.accessToken) } : null, null);
  }

  /** Un seul renouvellement à la fois, même si plusieurs requêtes reçoivent 401 en même temps. */
  function renew(): Promise<RestoreResult> {
    pending ??= options
      .refresh()
      .then((payload): RestoreResult => {
        if (!payload) {
          store(null, current ? { reason: 'expired' } : null);
          return { status: 'anonymous' };
        }
        set(payload);
        return { status: 'authenticated', session: current as Session };
      })
      .catch((error: unknown): RestoreResult => {
        const result = toResult(error);
        store(
          null,
          result.status === 'forbidden'
            ? { reason: 'forbidden', error: result.error }
            : { reason: 'unavailable', error },
        );
        return result;
      })
      .finally(() => {
        pending = null;
      });
    return pending;
  }

  return {
    /** Jeton d'accès encore valide, sinon `null`. */
    getAccessToken(): string | null {
      return current && now() < expiresAt ? current.accessToken : null;
    },
    /** Session en mémoire (référence stable entre deux changements, pour `useSyncExternalStore`). */
    get(): Session | null {
      return current;
    },
    /** Raison de la fin de la dernière session (déconnexion, expiration, refus), tant qu'aucune autre n'est ouverte. */
    ended(): SessionEnd | null {
      return ended;
    },
    set,
    /** Vide la session ; `logout` quand l'agent s'est déconnecté lui-même. */
    clear(reason?: 'logout'): void {
      store(null, reason ? { reason } : null);
    },
    /** Renouvelle la session ; `true` si un nouveau jeton est disponible (utilisé par le client sur 401). */
    refresh(): Promise<boolean> {
      return renew().then((result) => result.status === 'authenticated');
    },
    /** Reprend la session au chargement d'une page de l'espace : mémoire d'abord, sinon renouvellement. */
    restore(): Promise<RestoreResult> {
      return current ? Promise.resolve({ status: 'authenticated', session: current }) : renew();
    },
    subscribe(listener: Listener): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export type SessionStore = ReturnType<typeof createSessionStore>;

/** Session du navigateur, unique pour tout le back-office. */
export const session: SessionStore = createSessionStore({
  refresh: async () => (await import('./refresh')).refreshSession(),
});

const noSession = () => null;

/** Session en mémoire dans un composant client, à jour à chaque changement. Rien au rendu serveur. */
export function useSession(): Session | null {
  return useSyncExternalStore(session.subscribe, session.get, noSession);
}
