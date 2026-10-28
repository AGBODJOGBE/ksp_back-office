/**
 * Rôles du Nettoyage, tels que le contrat les attache à chaque route (`x-ksp-roles`). Ces fonctions
 * choisissent seulement quoi **montrer** : la gateway et le service cleaning restent seuls juges, et un
 * refus (403) s'affiche proprement. `super_admin` n'ouvre pas les routes du Nettoyage (contrat).
 */

export const CLEANING_ROLES = {
  supervisor: 'cleaning_supervisor',
  admin: 'cleaning_admin',
  agent: 'cleaning_agent',
} as const;

export interface CleaningAccess {
  /** Demandes, visites, devis, planification, paiements manuels, annulations, lecture des agents et équipes. */
  supervise: boolean;
  /** Catalogue, réglages, zones, rattachement des agents, indisponibilités, équipes. */
  administer: boolean;
  /** Missions et passages (démarrer, liste de contrôle, incident, reprise, clôture). */
  fieldWork: boolean;
}

export function cleaningAccess(roles: readonly string[]): CleaningAccess {
  const has = (role: string) => roles.includes(role);
  const administer = has(CLEANING_ROLES.admin);
  const supervise = administer || has(CLEANING_ROLES.supervisor);
  return { supervise, administer, fieldWork: supervise || has(CLEANING_ROLES.agent) };
}
