import { formatXof } from '@/lib/format';

/** Textes de l'éditeur d'une règle tarifaire et du simulateur. */

export const editorTexts = {
  newTitle: 'Nouvelle règle',
  newLead: 'La règle est créée en brouillon : simulez-la, puis publiez-la. Une règle publiée ne change plus.',
  newVersionTitle: 'Nouvelle version',
  newVersionLead: (label: string, version: number) =>
    `Nouvelle version de « ${label} » (version ${version}) : sa publication archivera la version en vigueur.`,
  create: 'Créer le brouillon',
  save: 'Enregistrer le brouillon',
  created: 'Brouillon créé.',
  saved: 'Brouillon enregistré.',
  label: 'Libellé',
  labelHint: 'Nom de la règle dans les listes et les mandats (140 caractères au plus).',
  object: 'Objet',
  mode: 'Calcul',
  fixedAmount: 'Montant (F CFA)',
  rate: 'Taux (%)',
  rateHint: 'Deux décimales au plus, par exemple 12,5.',
  target: 'Cible',
  offer: 'Offre',
  communeKey: 'Commune (facultatif)',
  communeHint: 'Clé de la commune (par exemple cotonou) ; vide : toutes les communes.',
  negotiated: 'Tarif négocié pour un créancier précis',
  negotiatedHint: 'Sa publication devra être validée par une autre personne (R-TA-04).',
  creditorType: 'Type de créancier',
  creditorTypes: { user: 'Compte (particulier)', organization: 'Organisation' },
  creditorId: 'Identifiant du créancier',
  creditorIdHint: 'Identifiant du compte ou de l’organisation (UUID), visible sur sa fiche Clients.',
  invalidUuid: 'Identifiant attendu au format UUID.',
  invalidCommune: 'Lettres minuscules sans accent, chiffres et tirets (par exemple abomey-calavi).',
  validity: 'Validité',
  validFrom: 'À partir du',
  validUntil: 'Jusqu’au (facultatif)',
  validityHint: 'Dates à minuit, heure du Bénin. Sans fin, la règle vaut jusqu’à sa prochaine version.',
  untilBeforeFrom: 'La fin doit suivre le début.',
  stageRates: 'Taux par étape atteinte',
  tiers: {
    title: 'Tranches',
    commissionLead:
      'Calcul progressif sur le cumul encaissé du dossier : chaque part est prise au taux de sa tranche.',
    feeLead: 'Un montant fixe, celui de la tranche où tombe le montant dû du dossier.',
    upTo: 'Jusqu’à (F CFA, inclus)',
    rate: 'Taux de la part (%)',
    amount: 'Frais (F CFA)',
    tier: (rank: number) => `Tranche ${rank}`,
    add: 'Ajouter une tranche',
    remove: (rank: number) => `Retirer la tranche ${rank}`,
    last: 'Dernière tranche : sans limite.',
    rangeCommission: (from: number, to: number | null, rate: string) =>
      to === null
        ? `Part du cumul au-delà de ${formatXof(from)} : ${rate}.`
        : `Part du cumul de ${formatXof(from)} à ${formatXof(to)} : ${rate}.`,
    rangeFee: (from: number, to: number | null, amount: string) =>
      to === null
        ? `Montant dû au-delà de ${formatXof(from)} : ${amount}.`
        : `Montant dû de ${formatXof(from)} à ${formatXof(to)} : ${amount}.`,
    notIncreasing: 'Chaque borne doit dépasser la précédente.',
    max: 'Vingt tranches au plus.',
    atLeastOne: 'Ajoutez au moins une tranche.',
  },
} as const;

export const simulatorTexts = {
  title: 'Simulateur',
  lead: 'Effet d’une règle sur un exemple, avec le détail ligne par ligne et la borne appliquée. Sans règle choisie : la règle publiée qui s’applique à la cible.',
  draftLead:
    'Essayez la règle sur un exemple avant de la publier. La commission est simulée sur un dossier soldé par cet encaissement.',
  baseAmount: 'Montant de base (F CFA)',
  baseHint: {
    case_fee: 'Montant dû du dossier.',
    recovery_commission: 'Somme encaissée, sur un dossier soldé par cet encaissement.',
    study_fee: 'Frais de dossier payés (le forfait ne les dépasse jamais).',
  },
  stage: 'Étape atteinte',
  stageHint: 'Pour une commission par étape ; l’amiable par défaut.',
  defaultStage: 'Amiable (par défaut)',
  run: 'Simuler',
  running: 'Calcul…',
  resultTitle: 'Résultat',
  amount: 'Montant calculé',
  rule: (version: number) => `Règle appliquée : version ${version}`,
  openRule: 'Ouvrir la règle appliquée',
  boundApplied: { minimum: 'Minimum appliqué.', maximum: 'Maximum appliqué.' },
  caption: 'Détail du calcul',
  columns: { label: 'Ligne', base: 'Base', rate: 'Taux', amount: 'Montant' },
  invalidBase: 'Saisissez un montant entier en francs CFA, supérieur à 0.',
} as const;
