/** Adresse de la connexion du back-office. */
export const LOGIN_PATH = '/connexion';

/** Paramètre de l'adresse de connexion qui indique où revenir après la connexion. */
export const RETURN_PARAM = 'retour';

/** Page ouverte après la connexion quand aucun retour n'est demandé : le tableau de bord. */
export const DEFAULT_RETURN_PATH = '/';

const BASE = 'http://backoffice.invalid';

/**
 * Chemin de retour sûr : uniquement un chemin interne au back-office (`/…`), jamais une autre adresse.
 * Refuse `//autre-site`, `/\autre-site`, les schémas (`https:`, `javascript:`), les caractères de
 * contrôle et la page de connexion elle-même (boucle). Sinon : le tableau de bord.
 */
export function safeReturnPath(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return DEFAULT_RETURN_PATH;
  // Barre oblique inverse et caractères de contrôle : certains navigateurs les lisent comme « // ».
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return DEFAULT_RETURN_PATH;
  let url: URL;
  try {
    url = new URL(value, BASE);
  } catch {
    return DEFAULT_RETURN_PATH;
  }
  if (url.origin !== BASE) return DEFAULT_RETURN_PATH;
  if (url.pathname === LOGIN_PATH || url.pathname.startsWith(`${LOGIN_PATH}/`)) return DEFAULT_RETURN_PATH;
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Adresse de connexion qui ramène ensuite à `path` (sans paramètre pour le tableau de bord). */
export function loginHref(path: string): string {
  const target = safeReturnPath(path);
  return target === DEFAULT_RETURN_PATH
    ? LOGIN_PATH
    : `${LOGIN_PATH}?${RETURN_PARAM}=${encodeURIComponent(target)}`;
}
