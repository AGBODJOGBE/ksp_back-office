/**
 * Droits de l'agent, lus dans le jeton d'accès (contrat `access-token.v1.schema.json`) : rôles (claim
 * `roles`) et permissions du RBAC dynamique (claims `perms` et `zone_perms`, ADR-057).
 *
 * La gateway ne les renvoie dans aucune réponse : le jeton est le seul endroit où le front peut les lire.
 * Le jeton n'est **pas vérifié** ici (aucune clé dans le navigateur) : ces droits servent seulement à
 * choisir quoi afficher. La gateway et les services vérifient la signature et les droits à chaque appel.
 *
 * Volontairement sans zod : ce module est chargé par le menu de toutes les pages.
 */

const ROLE = /^[a-z][a-z0-9_]*$/;
const PERMISSION = /^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/;

/** Droits portés par le jeton, pour l'affichage. */
export interface AccessGrants {
  /** Codes des rôles, sans doublon. */
  roles: string[];
  /**
   * Permissions effectives : `perms` (valables partout) et celles de `zone_perms` (limitées à des
   * communes : la gateway accepte la route si la permission figure dans au moins une zone), triées,
   * sans doublon. `null` quand le jeton ne porte ni `perms` ni `zone_perms` (jeton émis avant
   * ADR-057) : le front retombe alors sur les rôles par défaut des permissions.
   */
  permissions: string[] | null;
}

const NO_GRANTS: AccessGrants = { roles: [], permissions: null };

function decodeSegment(segment: string): unknown {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}

const permissionsIn = (list: unknown): string[] =>
  Array.isArray(list)
    ? list.filter((code): code is string => typeof code === 'string' && PERMISSION.test(code))
    : [];

function permissionsOf(claims: { perms?: unknown; zone_perms?: unknown }): string[] | null {
  const zones =
    claims.zone_perms && typeof claims.zone_perms === 'object' && !Array.isArray(claims.zone_perms)
      ? Object.values(claims.zone_perms as Record<string, unknown>)
      : null;
  if (!Array.isArray(claims.perms) && !zones) return null;
  const all = [...permissionsIn(claims.perms), ...(zones ?? []).flatMap(permissionsIn)];
  return [...new Set(all)].sort();
}

/** Rôles et permissions portés par le jeton ; aucun droit si le jeton est illisible. */
export function grantsFromAccessToken(token: string): AccessGrants {
  const payload = token.split('.')[1];
  if (!payload) return NO_GRANTS;
  try {
    const claims = decodeSegment(payload) as {
      roles?: unknown;
      perms?: unknown;
      zone_perms?: unknown;
    } | null;
    if (!claims || typeof claims !== 'object') return NO_GRANTS;
    const roles = Array.isArray(claims.roles)
      ? claims.roles
          .map((entry: unknown) => (entry as { role?: unknown } | null)?.role)
          .filter((role): role is string => typeof role === 'string' && ROLE.test(role))
      : [];
    return { roles: [...new Set(roles)], permissions: permissionsOf(claims) };
  } catch {
    return NO_GRANTS;
  }
}

/** Codes des rôles portés par le jeton (sans doublon), ou liste vide si le jeton est illisible. */
export function rolesFromAccessToken(token: string): string[] {
  return grantsFromAccessToken(token).roles;
}
