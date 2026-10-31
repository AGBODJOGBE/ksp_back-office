/**
 * Rôles de la facturation, tels que le contrat les attache à chaque route (`x-ksp-roles`). Ces
 * fonctions choisissent seulement quoi **montrer** : la gateway et le service billing restent seuls
 * juges, et un refus (403) s'affiche proprement.
 */

export const BILLING_ROLES = {
  finance: 'finance_officer',
  cleaningSupervisor: 'cleaning_supervisor',
  cleaningAdmin: 'cleaning_admin',
  superAdmin: 'super_admin',
} as const;

export interface BillingAccess {
  /** Liste et fiche des factures, paiement manuel (`/admin/billing/invoices*`). */
  invoices: boolean;
  /** Réglages de la facturation (`/admin/billing/settings`) : sans le superviseur du Nettoyage. */
  settings: boolean;
  /** Seuils d'impayés : réglages du Nettoyage (ADR-025), ouverts à son admin. */
  cleaningSettings: boolean;
}

export function billingAccess(roles: readonly string[]): BillingAccess {
  const has = (role: string) => roles.includes(role);
  const settings =
    has(BILLING_ROLES.finance) || has(BILLING_ROLES.cleaningAdmin) || has(BILLING_ROLES.superAdmin);
  return {
    invoices: settings || has(BILLING_ROLES.cleaningSupervisor),
    settings,
    cleaningSettings: has(BILLING_ROLES.cleaningAdmin) || has(BILLING_ROLES.superAdmin),
  };
}
