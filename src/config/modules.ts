/**
 * Modules du back-office (spécification des fronts, partie 5).
 * Un module n'apparaît que pour les agents qui ont l'un de ses rôles, et seulement à partir de sa phase.
 * Les rôles sont ceux des catalogues déclarés par chaque service auprès d'identity.
 */
export interface BackofficeModule {
  slug: string;
  label: string;
  description: string;
  /** Rôles qui donnent accès au module ; '*' = tout agent connecté. */
  roles: readonly string[];
  phase: 1 | 2 | 3 | 4;
}

export const SUPER_ADMIN = 'super_admin';

export const MODULES: readonly BackofficeModule[] = [
  {
    slug: 'tableau-de-bord',
    label: 'Tableau de bord',
    description: 'Indicateurs de chaque métier selon les rôles, tâches du jour, alertes.',
    roles: ['*'],
    phase: 1,
  },
  {
    slug: 'recouvrement',
    label: 'Recouvrement',
    description:
      'Dossiers par état, fiche dossier, décisions, affectations, relances planifiées, courriers, reversements, conseil et formations.',
    roles: ['recovery_agent', 'recovery_admin'],
    phase: 1,
  },
  {
    slug: 'nettoyage',
    label: 'Nettoyage',
    description:
      'Grille tarifaire du simulateur, devis, visites techniques, planning des équipes, missions avec photos, contrats récurrents.',
    roles: ['cleaning_supervisor', 'cleaning_admin'],
    phase: 1,
  },
  {
    slug: 'finance',
    label: 'Finance',
    description:
      'Paiements reçus, portefeuilles, demandes de versement validées par une autre personne, factures et avoirs, rapprochement.',
    roles: ['finance_officer'],
    phase: 1,
  },
  {
    slug: 'clients',
    label: 'Clients et comptes',
    description:
      "Recherche de comptes et d'organisations, détail, suspension et réactivation, historique de connexion.",
    roles: ['support_agent', 'recovery_admin', 'cleaning_admin'],
    phase: 1,
  },
  {
    slug: 'notifications',
    label: 'Notifications',
    description: 'Modèles de messages (SMS, WhatsApp, e-mail), historique des envois et des échecs.',
    roles: ['recovery_admin', 'cleaning_admin'],
    phase: 1,
  },
  {
    slug: 'administration',
    label: 'Administration',
    description: "Agents, rôles, paramètres généraux, journal d'audit.",
    roles: ['recovery_admin', 'cleaning_admin'],
    phase: 1,
  },
  {
    slug: 'immobilier',
    label: 'Immobilier',
    description:
      'Projets, étapes et planning, journal de chantier, appels de fonds, budget, fournisseurs, réalisations.',
    roles: ['realestate_site_manager', 'realestate_admin'],
    phase: 2,
  },
  {
    slug: 'impression',
    label: 'Impression',
    description:
      'File des BAT à valider, production, catalogue des supports, tarifs par palier, devis sur mesure.',
    roles: ['print_prepress', 'print_admin'],
    phase: 3,
  },
  {
    slug: 'livraison',
    label: 'Livraison',
    description:
      'Carte en direct des livreurs et des courses, répartition, livreurs, zones et tarifs, espèces à rapprocher.',
    roles: ['delivery_dispatcher', 'delivery_admin'],
    phase: 3,
  },
  {
    slug: 'marketplace',
    label: 'Marketplace',
    description:
      'Validation des vendeurs, modération des produits, commandes, litiges et retours, commissions, catégories.',
    roles: ['commerce_admin'],
    phase: 4,
  },
];

/** Phase en cours de l'écosystème : les modules des phases suivantes restent masqués. */
export const CURRENT_PHASE = 1;
