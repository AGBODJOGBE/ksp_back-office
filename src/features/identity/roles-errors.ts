import { ApiError, apiErrorText } from '@/lib/api';
import { roleTexts } from './roles-texts';

/** Suite à donner à une erreur d'écriture sur un rôle. */
export interface RoleErrorOutcome {
  message: string;
  /** Le rôle a changé entre-temps (désactivé, non modifiable, encore attribué) : relire la fiche. */
  refreshRole: boolean;
  /** Une permission cochée n'existe plus : relire le catalogue. */
  refreshCatalog: boolean;
}

/**
 * Erreurs métier des routes des rôles (contrat : `IDENTITY_ROLE_*`, `IDENTITY_PERMISSION_NOT_FOUND`)
 * → message lisible. Les autres (motif invalide, droits, panne) gardent le message de la gateway.
 */
export function roleError(error: unknown): RoleErrorOutcome {
  const outcome = (message: string, refreshRole = false, refreshCatalog = false) => ({
    message,
    refreshRole,
    refreshCatalog,
  });
  if (!(error instanceof ApiError)) return outcome(apiErrorText(error));
  const e = roleTexts.errors;
  switch (error.code) {
    case 'IDENTITY_ROLE_ALREADY_EXISTS':
      return outcome(e.exists);
    case 'IDENTITY_PERMISSION_NOT_FOUND':
      return outcome(e.unknownPermission, false, true);
    case 'IDENTITY_ROLE_NOT_EDITABLE':
      return outcome(e.notEditable, true);
    case 'IDENTITY_ROLE_INACTIVE':
      return outcome(e.inactive, true);
    case 'IDENTITY_ROLE_IN_USE': {
      const count = Number(error.details.activeAssignments);
      return outcome(roleTexts.deactivate.inUse(Number.isFinite(count) && count > 0 ? count : 1), true);
    }
    default:
      return outcome(apiErrorText(error));
  }
}
