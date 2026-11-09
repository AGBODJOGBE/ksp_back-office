/**
 * Rôles du service payment, tels que le contrat les attache à `GET /api/v1/admin/payment/payments` et
 * aux routes `/api/v1/admin/payment/payouts*` (`x-ksp-roles`). Affichage seulement : la gateway et le
 * service payment restent seuls juges.
 */

export const PAYMENT_ROLES = ['finance_officer', 'cleaning_admin', 'super_admin'] as const;
/** Reversements par Mobile Money (ADR-041) : la finance seule. */
export const PAYOUT_ROLES = ['finance_officer', 'super_admin'] as const;

export interface PaymentAccess {
  /** Liste des paiements en ligne. */
  list: boolean;
  /** Liste des reversements, confirmation ou échec d'un reversement manuel. */
  payouts: boolean;
}

export function paymentAccess(roles: readonly string[]): PaymentAccess {
  const any = (list: readonly string[]) => list.some((role) => roles.includes(role));
  return { list: any(PAYMENT_ROLES), payouts: any(PAYOUT_ROLES) };
}
