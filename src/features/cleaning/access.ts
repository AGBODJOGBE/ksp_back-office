/**
 * Droits d'affichage du Nettoyage v2. Chaque route `/api/v1/admin/cleaning/*` du contrat déclare une
 * permission (`x-ksp-permission`, ADR-057) et les rôles qui la portent par défaut
 * (`x-ksp-default-roles`).
 *
 * - Jeton qui porte des permissions (claims `perms`, `zone_perms`) : elles seules décident, comme à la
 *   gateway. Un rôle créé ou modifié au back-office s'applique donc sans changer le code.
 * - Jeton qui n'en porte pas (émis avant ADR-057) : **repli** sur la table ci-dessous, qui traduit les
 *   rôles de la session en permissions d'après leurs rôles par défaut.
 *
 * Affichage seulement : la gateway et le service cleaning restent seuls juges, et un refus (403)
 * s'affiche proprement.
 */

import { CLEANING_BACKOFFICE_PERMISSIONS, type CleaningPermission } from '@/config/permissions';
import { fromRoles, type Grants, hasPermission } from '@/lib/grants';

export type { CleaningPermission } from '@/config/permissions';

const ADMIN = 'cleaning_admin';
const SUPERVISOR = 'cleaning_supervisor';
const SUPPORT = 'support_agent';
const SUPER_ADMIN = 'super_admin';

/** Repli (jeton sans permissions) : rôles qui portent chaque permission par défaut (`x-ksp-default-roles`). */
const DEFAULT_ROLES = {
  /** Catalogue, compétences, jours fériés, zones et communes en lecture ; simulateur. */
  'cleaning.catalog.read': [ADMIN, SUPERVISOR, SUPPORT, SUPER_ADMIN],
  /** Catalogue, compétences, jours fériés : créer, modifier, désactiver ; tarifs. */
  'cleaning.catalog.manage': [ADMIN, SUPER_ADMIN],
  /** Zones desservies : ouvrir, modifier, activer ou désactiver. */
  'cleaning.zone.manage': [ADMIN, SUPER_ADMIN],
  /** Dossiers, visites et réglages en lecture. */
  'cleaning.request.read': [ADMIN, SUPERVISOR, SUPPORT, SUPER_ADMIN],
  /** Dossiers et visites : traiter. */
  'cleaning.request.process': [ADMIN, SUPERVISOR, SUPER_ADMIN],
  /** Devis. */
  'cleaning.quote.manage': [ADMIN, SUPERVISOR, SUPER_ADMIN],
  /** Remise au-delà du seuil. */
  'cleaning.quote.adjust_price': [ADMIN, SUPER_ADMIN],
  /** Planning, affectations, agents et équipes en lecture. */
  'cleaning.planning.manage': [ADMIN, SUPERVISOR, SUPER_ADMIN],
  /** Agents : créer, valider, suspendre. */
  'cleaning.agent.manage': [ADMIN, SUPER_ADMIN],
  /** Programmes et séances en lecture. */
  'cleaning.program.read': [ADMIN, SUPERVISOR, SUPPORT, SUPER_ADMIN],
  /** Programmes et séances : décisions. */
  'cleaning.program.manage': [ADMIN, SUPERVISOR, SUPER_ADMIN],
  /** Réclamations. */
  'cleaning.claim.manage': [ADMIN, SUPERVISOR, SUPPORT, SUPER_ADMIN],
  /** Réglages : modifier. */
  'cleaning.settings.manage': [ADMIN, SUPER_ADMIN],
} as const satisfies Record<CleaningPermission, readonly string[]>;

/** Permissions du Nettoyage accordées à la session (affichage seulement). */
export type CleaningAccess = Readonly<Record<CleaningPermission, boolean>>;

export const CLEANING_PERMISSIONS: readonly CleaningPermission[] = CLEANING_BACKOFFICE_PERMISSIONS;

/**
 * Droits de la session → permissions du Nettoyage. Reçoit les droits du jeton (`Grants`, la session
 * convient), ou des rôles seuls (repli, comme un jeton émis avant ADR-057).
 */
export function cleaningAccess(grants: Grants | readonly string[]): CleaningAccess {
  const given = isRoleList(grants) ? fromRoles(grants) : grants;
  return Object.fromEntries(
    CLEANING_PERMISSIONS.map((permission) => [
      permission,
      hasPermission(given, permission, DEFAULT_ROLES[permission]),
    ]),
  ) as CleaningAccess;
}

function isRoleList(grants: Grants | readonly string[]): grants is readonly string[] {
  return Array.isArray(grants);
}

/** Rôles qui portent une permission par défaut (repli de la file « À traiter » de Ma journée). */
export const rolesWith = (permission: CleaningPermission): readonly string[] => DEFAULT_ROLES[permission];
