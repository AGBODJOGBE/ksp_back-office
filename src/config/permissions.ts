/**
 * Permissions du RBAC dynamique (ADR-057) exigées par les routes du back-office (`x-ksp-permission`
 * du contrat). Seul le Nettoyage v2 les déclare aujourd'hui (routes `/api/v1/admin/cleaning/*`) ; les
 * autres modules décident encore par rôle (`x-ksp-roles`) et n'ont pas de permission ici.
 *
 * Les permissions de l'application de l'agent (`cleaning.visit.perform`, `cleaning.session.perform`)
 * n'ouvrent aucun écran du back-office.
 */
export const CLEANING_BACKOFFICE_PERMISSIONS = [
  'cleaning.catalog.read',
  'cleaning.catalog.manage',
  'cleaning.zone.manage',
  'cleaning.request.read',
  'cleaning.request.process',
  'cleaning.quote.manage',
  'cleaning.quote.adjust_price',
  'cleaning.planning.manage',
  'cleaning.agent.manage',
  'cleaning.program.read',
  'cleaning.program.manage',
  'cleaning.claim.manage',
  'cleaning.settings.manage',
] as const;

export type CleaningPermission = (typeof CLEANING_BACKOFFICE_PERMISSIONS)[number];
