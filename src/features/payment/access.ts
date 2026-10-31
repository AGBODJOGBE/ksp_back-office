/**
 * Rôles des paiements en ligne, tels que le contrat les attache à `GET /api/v1/admin/payment/payments`
 * (`x-ksp-roles`). Affichage seulement : la gateway et le service payment restent seuls juges.
 */

export const PAYMENT_ROLES = ['finance_officer', 'cleaning_admin', 'super_admin'] as const;

export interface PaymentAccess {
  /** Liste des paiements en ligne. */
  list: boolean;
}

export function paymentAccess(roles: readonly string[]): PaymentAccess {
  return { list: PAYMENT_ROLES.some((role) => roles.includes(role)) };
}
