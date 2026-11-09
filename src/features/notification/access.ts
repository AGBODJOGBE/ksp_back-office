/**
 * Rôles du back-office des notifications, tels que le contrat les attache aux routes
 * `/api/v1/admin/notification/…` (`x-ksp-roles`, ADR-039). Affichage seulement : la gateway et le service
 * notification restent seuls juges.
 */
export const NOTIFICATION_ROLES = ['super_admin', 'support_agent'] as const;
