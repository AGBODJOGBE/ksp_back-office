/**
 * Droits d'affichage du Nettoyage v2. Chaque route `/api/v1/admin/cleaning/*` du contrat déclare une
 * permission (`x-ksp-permission`, ADR-057) et les rôles qui la portent par défaut
 * (`x-ksp-default-roles`). Le back-office décide encore par rôle (claim `roles` du jeton) : cette table
 * traduit les rôles de la session en permissions, et **seul ce fichier** le fait. Le passage aux
 * permissions du jeton (claim `perms`, lot séparé) ne changera que `cleaningAccess`.
 *
 * Affichage seulement : la gateway et le service cleaning restent seuls juges, et un refus (403)
 * s'affiche proprement.
 */

const ADMIN = 'cleaning_admin';
const SUPERVISOR = 'cleaning_supervisor';
const SUPPORT = 'support_agent';
const SUPER_ADMIN = 'super_admin';

/** Permissions du contrat et rôles qui les portent par défaut (`x-ksp-default-roles`). */
const DEFAULT_ROLES = {
  /** Catalogue, compétences, jours fériés, zones et communes en lecture ; simulateur. */
  'cleaning.catalog.read': [ADMIN, SUPERVISOR, SUPPORT, SUPER_ADMIN],
  /** Catalogue, compétences, jours fériés : créer, modifier, désactiver ; tarifs. */
  'cleaning.catalog.manage': [ADMIN, SUPER_ADMIN],
  /** Zones desservies : ouvrir, modifier, activer ou désactiver. */
  'cleaning.zone.manage': [ADMIN, SUPER_ADMIN],
  /** Dossiers, visites et réglages en lecture. */
  'cleaning.request.read': [ADMIN, SUPERVISOR, SUPPORT, SUPER_ADMIN],
  /** Dossiers et visites : traiter (sous-lot 1b). */
  'cleaning.request.process': [ADMIN, SUPERVISOR, SUPER_ADMIN],
  /** Devis (sous-lot 1b). */
  'cleaning.quote.manage': [ADMIN, SUPERVISOR, SUPER_ADMIN],
  /** Remise au-delà du seuil (sous-lot 1b). */
  'cleaning.quote.adjust_price': [ADMIN, SUPER_ADMIN],
  /** Planning, affectations, agents et équipes en lecture (sous-lot 1c). */
  'cleaning.planning.manage': [ADMIN, SUPERVISOR, SUPER_ADMIN],
  /** Agents : créer, valider, suspendre (sous-lot 1c). */
  'cleaning.agent.manage': [ADMIN, SUPER_ADMIN],
  /** Programmes et séances en lecture (sous-lot 1c). */
  'cleaning.program.read': [ADMIN, SUPERVISOR, SUPPORT, SUPER_ADMIN],
  /** Programmes et séances : décisions (sous-lot 1c). */
  'cleaning.program.manage': [ADMIN, SUPERVISOR, SUPER_ADMIN],
  /** Réclamations (sous-lot 1c). */
  'cleaning.claim.manage': [ADMIN, SUPERVISOR, SUPPORT, SUPER_ADMIN],
  /** Réglages : modifier. */
  'cleaning.settings.manage': [ADMIN, SUPER_ADMIN],
} as const satisfies Record<string, readonly string[]>;

export type CleaningPermission = keyof typeof DEFAULT_ROLES;

/** Permissions du Nettoyage accordées à la session (affichage seulement). */
export type CleaningAccess = Readonly<Record<CleaningPermission, boolean>>;

export const CLEANING_PERMISSIONS = Object.keys(DEFAULT_ROLES) as CleaningPermission[];

/** Rôles de la session → permissions du Nettoyage, d'après les rôles par défaut du contrat. */
export function cleaningAccess(roles: readonly string[]): CleaningAccess {
  return Object.fromEntries(
    CLEANING_PERMISSIONS.map((permission) => [
      permission,
      (DEFAULT_ROLES[permission] as readonly string[]).some((role) => roles.includes(role)),
    ]),
  ) as CleaningAccess;
}
