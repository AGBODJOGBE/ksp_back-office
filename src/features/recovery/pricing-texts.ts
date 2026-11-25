import type { BadgeTone } from '@/components/ui/badge';
import { names } from './texts';

/** Textes de la tarification du recouvrement (ADR-062). */

export const objectLabel = names({
  case_fee: 'Frais de dossier',
  recovery_commission: 'Commission de recouvrement',
  study_fee: 'Forfait d’étude',
});

export const modeLabel = names({
  fixed: 'Montant fixe',
  percentage: 'Pourcentage',
  tiered: 'Par tranches',
  by_stage: 'Par étape atteinte',
});

export const offerLabel = names({
  b2b: 'Entreprises (B2B)',
  b2c: 'Particuliers (B2C)',
  rent: 'Loyers',
  any: 'Toutes les offres',
});

const STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  draft: { label: 'Brouillon', tone: 'neutral' },
  pending_approval: { label: 'À valider', tone: 'warning' },
  published: { label: 'Publiée', tone: 'action' },
  archived: { label: 'Archivée', tone: 'neutral' },
};
export const ruleStatus = (code: string) => STATUS[code] ?? { label: code, tone: 'neutral' as const };

export const pricingTexts = {
  nav: { label: 'Sections de la tarification', rules: 'Règles', simulator: 'Simulateur' },
  list: {
    title: 'Tarification',
    lead: 'Frais de dossier, commission de recouvrement et forfait d’étude : chaque prix est une règle versionnée, figée dans le mandat à sa signature.',
    caption: 'Règles tarifaires',
    empty: 'Aucune règle pour ces critères.',
    create: 'Nouvelle règle',
    object: 'Objet',
    status: 'État',
    offer: 'Offre',
    all: 'Tous',
    allFeminine: 'Toutes',
    columns: {
      label: 'Règle',
      object: 'Objet',
      mode: 'Calcul',
      target: 'Cible',
      validity: 'Validité',
      status: 'État',
    },
    version: (value: number) => `version ${value}`,
    none: 'Aucune',
  },
  detail: {
    title: 'Règle tarifaire',
    back: 'Toutes les règles',
    createdBy: 'Créée par',
    approvedBy: 'Validée par',
    publishedAt: 'Publiée le',
    previous: 'Version précédente',
    openPrevious: 'Ouvrir la version précédente',
    summary: 'Règle',
    edit: 'Modifier le brouillon',
    simulate: 'Simuler avant de publier',
    simulateRule: 'Simuler cette règle',
    actions: 'Décisions',
    publish: 'Publier',
    publishTitle: 'Publier cette règle ?',
    publishText:
      'Une règle publiée ne change plus : toute modification créera une nouvelle version. Sa publication archive la version précédente.',
    publishNegotiated:
      'Tarif négocié pour un créancier précis : la règle passera « À valider » et ne sera publiée qu’après la validation d’une autre personne.',
    published: 'Règle publiée.',
    submitted: 'Règle envoyée à la validation d’une autre personne.',
    approve: 'Valider et publier',
    approveTitle: 'Valider ce tarif négocié ?',
    approveText: 'La règle sera publiée et s’appliquera aux nouveaux mandats de ce créancier.',
    approved: 'Tarif négocié validé et publié.',
    ownRule: 'Vous avez créé cette règle : sa validation revient à une autre personne.',
    archive: 'Archiver',
    archiveTitle: 'Archiver cette règle ?',
    archiveText:
      'Les mandats déjà signés gardent leur version (R-CO-02). Une règle archivée ne s’applique plus aux nouveaux dossiers.',
    archiveReason: 'Motif',
    archiveReasonHint: 'De 3 à 500 caractères ; inscrit au journal d’audit.',
    archived: 'Règle archivée.',
    reasonLength: 'Entre 3 et 500 caractères.',
    newVersion: 'Créer une nouvelle version',
    readOnly: 'Lecture seule : la tarification est réglée par l’administration du Recouvrement.',
    noAction: 'Règle archivée : plus aucune décision possible.',
  },
  target: {
    negotiated: 'Tarif négocié',
    allCommunes: 'toutes les communes',
    commune: (key: string) => `commune ${key}`,
    // Fin de l'identifiant : le début d'un UUID v7 (horodatage) se ressemble d'un créancier à l'autre.
    creditor: (type: string, id: string) =>
      `${type === 'organization' ? 'organisation' : 'compte'} …${id.slice(-8)}`,
  },
  validity: {
    from: (date: string) => `à partir du ${date}`,
    range: (from: string, to: string) => `du ${from} au ${to}`,
  },
  /** Ce que chaque objet calcule, et les modes que le service accepte (ADR-062, décisions 2 et 3). */
  objects: {
    case_fee:
      'Payés par le créancier à l’envoi du dossier. Montant fixe, ou montant fixe selon la tranche où tombe le montant dû.',
    recovery_commission:
      'Prélevée sur chaque encaissement. Pourcentage, montant fixe, taux par étape atteinte, ou taux par tranches calculé de façon progressive sur le cumul encaissé du dossier.',
    study_fee: 'Retenu sur les frais remboursés d’un dossier irrecevable. Montant fixe uniquement.',
  },
  modes: {
    fixed: 'Un montant en francs CFA.',
    percentage: 'Un taux appliqué au montant de base.',
    tiered_commission:
      'Progressif : chaque part du cumul encaissé est prise au taux de sa tranche. Exemple : 15 % jusqu’à 1 000 000 F CFA puis 10 % au-delà donnent 150 000 F CFA à 1 000 000, puis 160 000 F CFA à 1 100 000.',
    tiered_fee: 'Le montant de la tranche où tombe le montant dû du dossier (un seul montant, pas de cumul).',
    by_stage: 'Le taux de l’étape atteinte au moment de chaque encaissement.',
  },
  bounds: {
    title: 'Bornes (facultatives)',
    commission:
      'Le minimum vaut pour le cumul du dossier : il est complété sur l’encaissement qui solde le dossier, jamais exigé de chaque versement. Le maximum vaut pour chaque encaissement.',
    fee: 'Bornes du montant calculé.',
    minimum: 'Minimum (F CFA)',
    maximum: 'Maximum (F CFA)',
    min: (amount: string) => `minimum ${amount}`,
    max: (amount: string) => `maximum ${amount}`,
    minAboveMax: 'Le minimum dépasse le maximum.',
  },
} as const;
