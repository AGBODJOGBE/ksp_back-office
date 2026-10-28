/**
 * Rôles de l'agent, lus dans le jeton d'accès (claim `roles`, contrat `access-token.v1.schema.json`).
 *
 * La gateway ne les renvoie dans aucune réponse : le jeton est le seul endroit où le front peut les lire.
 * Le jeton n'est **pas vérifié** ici (aucune clé dans le navigateur) : ces rôles servent seulement à
 * choisir quoi afficher. La gateway et les services vérifient la signature et les droits à chaque appel.
 *
 * Volontairement sans zod : ce module est chargé par le menu de toutes les pages.
 */

function decodeSegment(segment: string): unknown {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}

/** Codes des rôles portés par le jeton (sans doublon), ou liste vide si le jeton est illisible. */
export function rolesFromAccessToken(token: string): string[] {
  const payload = token.split('.')[1];
  if (!payload) return [];
  try {
    const claims = decodeSegment(payload) as { roles?: unknown } | null;
    if (!claims || !Array.isArray(claims.roles)) return [];
    const codes = claims.roles
      .map((entry: unknown) => (entry as { role?: unknown } | null)?.role)
      .filter((role): role is string => typeof role === 'string' && /^[a-z][a-z0-9_]*$/.test(role));
    return [...new Set(codes)];
  } catch {
    return [];
  }
}
