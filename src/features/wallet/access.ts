/**
 * Rôles des portefeuilles, tels que le contrat les attache aux routes `/api/v1/admin/wallet/*`
 * (`x-ksp-roles`, ADR-042 et ADR-046). Affichage seulement : la gateway et le service wallet restent
 * seuls juges, et un refus (403) s'affiche proprement.
 */
export const WALLET_ROLES = ['finance_officer', 'super_admin'] as const;

/** Rôles de la recherche d'un compte par son numéro (`POST /api/v1/admin/identity/accounts/lookup`). */
const LOOKUP_ROLES = ['cleaning_admin', 'super_admin'] as const;

export interface WalletAccess {
  /** Vue d'ensemble, portefeuille et relevé d'un titulaire, crédit manuel. */
  wallets: boolean;
  /** Recherche d'un particulier par son numéro (identity). */
  searchByPhone: boolean;
}

export function walletAccess(roles: readonly string[]): WalletAccess {
  const any = (list: readonly string[]) => list.some((role) => roles.includes(role));
  return { wallets: any(WALLET_ROLES), searchByPhone: any(LOOKUP_ROLES) };
}
