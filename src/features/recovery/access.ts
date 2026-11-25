/**
 * Droits d'affichage du Recouvrement : seul endroit qui décide. Le contrat ne déclare aucune permission
 * (`x-ksp-permission`) pour les routes `/api/v1/admin/recovery/*` et `/api/v1/admin/billing/commission-invoices*` :
 * chaque route donne ses rôles (`x-ksp-roles`), repris ici tels quels. Un jeton qui porte des
 * permissions (ADR-057) n'y change rien tant que le contrat n'en déclare pas.
 *
 * Affichage seulement : la gateway et le service recovery restent seuls juges, et un refus (403)
 * s'affiche proprement.
 */

import type { Grants } from '@/lib/grants';

const AGENT = 'recovery_agent';
const SUPERVISOR = 'recovery_supervisor';
const LEGAL = 'legal_officer';
const ADMIN = 'recovery_admin';
const SUPER_ADMIN = 'super_admin';
const FINANCE = 'finance_officer';

/** Rôles du contrat par capacité (route qui l'alimente entre parenthèses). */
const ROLES = {
  /** Tableau de bord (`GET /recovery/overview`). */
  overview: [AGENT, SUPERVISOR, LEGAL, ADMIN, SUPER_ADMIN, FINANCE],
  /** Ma journée du chargé (`GET /recovery/my-day`). */
  myDay: [AGENT, SUPERVISOR, LEGAL, ADMIN, SUPER_ADMIN],
  /** Dossiers, fiche et journal en lecture (`GET /recovery/cases*`, sous-lot 4b). */
  cases: [AGENT, SUPERVISOR, LEGAL, ADMIN, SUPER_ADMIN, FINANCE],
  /** Paiements hors ligne à valider (`GET /recovery/offline-payments`, sous-lot 4b). */
  offlinePayments: [FINANCE, SUPER_ADMIN],
  /** Règles tarifaires et simulateur (`GET /recovery/pricing-rules*`, `POST /recovery/pricing-simulations`). */
  pricingRead: [ADMIN, SUPER_ADMIN, FINANCE],
  /** Créer, modifier, publier, valider, archiver une règle. */
  pricingManage: [ADMIN, SUPER_ADMIN],
  /** Réglages (`GET`, `PUT /recovery/settings`). */
  settings: [ADMIN, SUPER_ADMIN],
  /** Jours fériés en lecture (`GET /recovery/holidays/{year}`). */
  holidaysRead: [AGENT, SUPERVISOR, LEGAL, ADMIN, SUPER_ADMIN, FINANCE],
  /** Jours fériés : fixer la liste d'une année (`PUT /recovery/holidays/{year}`). */
  holidaysManage: [ADMIN, SUPER_ADMIN],
  /** Factures de commission (`GET /billing/commission-invoices*`, ADR-064). */
  commissionInvoices: [FINANCE, SUPER_ADMIN, ADMIN],
} as const satisfies Record<string, readonly string[]>;

export type RecoveryCapability = keyof typeof ROLES;
export type RecoveryAccess = Readonly<Record<RecoveryCapability, boolean>>;

export const RECOVERY_CAPABILITIES = Object.keys(ROLES) as RecoveryCapability[];

/** Rôles qui ouvrent le module : union des rôles de ses routes (repris par `config/modules.ts`). */
export const RECOVERY_MODULE_ROLES: readonly string[] = [...new Set(Object.values(ROLES).flat())];

/** Rôles d'une capacité (sections de la file « À traiter »). */
export const rolesFor = (capability: RecoveryCapability): readonly string[] => ROLES[capability];

/** Droits de la session → capacités du Recouvrement (rôles du jeton ; `Grants` ou rôles seuls). */
export function recoveryAccess(grants: Grants | readonly string[]): RecoveryAccess {
  const roles = isRoleList(grants) ? grants : grants.roles;
  return Object.fromEntries(
    RECOVERY_CAPABILITIES.map((capability) => [
      capability,
      ROLES[capability].some((role: string) => roles.includes(role)),
    ]),
  ) as RecoveryAccess;
}

function isRoleList(grants: Grants | readonly string[]): grants is readonly string[] {
  return Array.isArray(grants);
}
