/**
 * Droits d'affichage de la session (ADR-057) : rôles et permissions lus dans le jeton d'accès
 * (`lib/api/claims.ts`). Affichage seulement : la gateway et les services restent seuls juges.
 *
 * Volontairement minuscule et sans dépendance : le menu le lit sur toutes les pages.
 */

export interface Grants {
  readonly roles: readonly string[];
  /** Permissions du jeton ; `null` pour un jeton qui n'en porte pas (émis avant ADR-057). */
  readonly permissions: readonly string[] | null;
}

/** Aucun droit (pas de session). */
export const NO_GRANTS: Grants = { roles: [], permissions: null };

/** Droits faits de rôles seuls, comme un jeton émis avant ADR-057 (repli par rôles). */
export const fromRoles = (roles: readonly string[]): Grants => ({ roles, permissions: null });

/**
 * La session a-t-elle cette permission ? Jeton qui porte des permissions : elles seules décident,
 * comme à la gateway (un rôle créé au back-office fonctionne sans changer le code). Jeton sans
 * permissions : repli sur les rôles qui portent la permission par défaut (`x-ksp-default-roles`).
 */
export function hasPermission(
  grants: Grants,
  permission: string,
  defaultRoles: readonly string[] = [],
): boolean {
  return grants.permissions
    ? grants.permissions.includes(permission)
    : defaultRoles.some((role) => grants.roles.includes(role));
}

/** Au moins une de ces permissions (même règle que `hasPermission`). */
export function hasAnyPermission(
  grants: Grants,
  permissions: readonly string[],
  defaultRoles: readonly string[] = [],
): boolean {
  return grants.permissions
    ? permissions.some((permission) => grants.permissions?.includes(permission))
    : defaultRoles.some((role) => grants.roles.includes(role));
}
