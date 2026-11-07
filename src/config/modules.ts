/**
 * Modules du back-office (spécification des fronts, partie 5).
 * Un module n'apparaît que pour les agents qui ont l'un de ses rôles, et seulement à partir de sa phase.
 * Les rôles sont ceux des catalogues déclarés par chaque service auprès d'identity.
 */

/** Groupes du menu, dans leur ordre d'affichage. Un groupe sans module visible n'est pas affiché. */
export const MODULE_GROUPS = [
  { id: 'journee', label: 'Ma journée' },
  { id: 'operations', label: 'Opérations' },
  { id: 'finance', label: 'Finance' },
  { id: 'clients', label: 'Clients' },
  { id: 'pilotage', label: 'Pilotage' },
] as const;

export type ModuleGroup = (typeof MODULE_GROUPS)[number]['id'];

export interface BackofficeModule {
  slug: string;
  label: string;
  description: string;
  /** Rôles qui donnent accès au module ; '*' = tout agent connecté. */
  roles: readonly string[];
  phase: 1 | 2 | 3 | 4;
  /** Groupe du menu (`MODULE_GROUPS`). */
  group: ModuleGroup;
}

export const SUPER_ADMIN = 'super_admin';

export const MODULES: readonly BackofficeModule[] = [
  {
    // L'adresse reste `/` (accueil) ; le libellé suit la file « À traiter » (étape 2).
    slug: 'tableau-de-bord',
    label: 'Ma journée',
    description: 'Ce qui attend une action, du plus urgent au moins urgent, selon vos rôles.',
    roles: ['*'],
    phase: 1,
    group: 'journee',
  },
  {
    slug: 'recouvrement',
    label: 'Recouvrement',
    description:
      'Dossiers par état, fiche dossier, décisions, affectations, relances planifiées, courriers, reversements, conseil et formations.',
    roles: ['recovery_agent', 'recovery_admin'],
    phase: 1,
    group: 'operations',
  },
  {
    slug: 'nettoyage',
    label: 'Nettoyage',
    description:
      'Grille tarifaire du simulateur, devis, visites techniques, planning des équipes, missions avec photos, contrats récurrents.',
    // cleaning_agent : missions, passages et visites sur le terrain (contrat, routes /admin/cleaning/missions,
    // /interventions et /visits).
    // super_admin : même portée que cleaning_admin sur toutes les routes du Nettoyage (contrat).
    roles: ['cleaning_supervisor', 'cleaning_admin', 'cleaning_agent', SUPER_ADMIN],
    phase: 1,
    group: 'operations',
  },
  {
    slug: 'finance',
    label: 'Finance',
    description:
      'Paiements reçus, portefeuilles, demandes de versement validées par une autre personne, factures et avoirs, rapprochement.',
    // Rôles du contrat : factures (finance, superviseur et admin du Nettoyage), réglages (sans le
    // superviseur), paiements en ligne (finance, admin du Nettoyage). super_admin voit tout.
    roles: ['finance_officer', 'cleaning_supervisor', 'cleaning_admin', SUPER_ADMIN],
    phase: 1,
    group: 'finance',
  },
  {
    slug: 'clients',
    label: 'Clients et comptes',
    description:
      "Recherche de comptes et d'organisations, détail, suspension et réactivation, historique de connexion.",
    // Rôles du contrat (comptes entreprise) : consultation super_admin et support_agent, décisions super_admin.
    roles: ['support_agent', SUPER_ADMIN],
    phase: 1,
    group: 'clients',
  },
  {
    slug: 'notifications',
    label: 'Notifications',
    description: 'Modèles de messages (SMS, WhatsApp, e-mail), historique des envois et des échecs.',
    roles: ['recovery_admin', 'cleaning_admin'],
    phase: 1,
    group: 'pilotage',
  },
  {
    slug: 'administration',
    label: 'Administration',
    description:
      "Comptes et rôles du back-office (attribution, retrait, suspension, double authentification), paramètres généraux, journal d'audit.",
    // Rôles du contrat (administration des comptes, ADR-043) : super_admin, et l'administrateur de chaque
    // métier pour les rôles de son métier.
    roles: ['recovery_admin', 'cleaning_admin'],
    phase: 1,
    group: 'pilotage',
  },
  {
    slug: 'immobilier',
    label: 'Immobilier',
    description:
      'Projets, étapes et planning, journal de chantier, appels de fonds, budget, fournisseurs, réalisations.',
    roles: ['realestate_site_manager', 'realestate_admin'],
    phase: 2,
    group: 'operations',
  },
  {
    slug: 'impression',
    label: 'Impression',
    description:
      'File des BAT à valider, production, catalogue des supports, tarifs par palier, devis sur mesure.',
    roles: ['print_prepress', 'print_admin'],
    phase: 3,
    group: 'operations',
  },
  {
    slug: 'livraison',
    label: 'Livraison',
    description:
      'Carte en direct des livreurs et des courses, répartition, livreurs, zones et tarifs, espèces à rapprocher.',
    roles: ['delivery_dispatcher', 'delivery_admin'],
    phase: 3,
    group: 'operations',
  },
  {
    slug: 'marketplace',
    label: 'Marketplace',
    description:
      'Validation des vendeurs, modération des produits, commandes, litiges et retours, commissions, catégories.',
    roles: ['commerce_admin'],
    phase: 4,
    group: 'operations',
  },
];

/**
 * Modules qui ont leurs propres écrans (une route statique par module, `src/app/(app)/<slug>`) : ils
 * sortent des pages d'attente générées par `[module]`, pour qu'une adresse n'ait jamais deux pages.
 */
export const MODULES_WITH_SCREENS: readonly string[] = ['nettoyage', 'finance', 'clients', 'administration'];

/** Phase en cours de l'écosystème : les modules des phases suivantes restent masqués. */
export const CURRENT_PHASE = 1;
