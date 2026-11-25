import type { DaySetting, ScaleKey, ScoreCriterion } from './settings-schemas';

/** Textes des réglages du recouvrement et des jours fériés (partie 17.1). */

/** Libellé et unité de chaque réglage entier. */
export const DAY_SETTING_TEXTS: Record<DaySetting, { label: string; unit: string }> = {
  feePaymentDays: { label: 'Paiement des frais de dossier', unit: 'jours' },
  reviewBusinessDays: { label: 'Décision de recevabilité', unit: 'jours ouvrés' },
  infoCompletionDays: { label: 'Complément demandé au créancier', unit: 'jours' },
  noticeResponseDays: { label: 'Réponse du débiteur à la notification', unit: 'jours' },
  installmentGraceDays: { label: 'Tolérance après une échéance', unit: 'jours' },
  missedInstallmentsBeforeAmicable: {
    label: 'Échéances manquées avant la relance amiable',
    unit: 'échéances',
  },
  amicableDurationDays: { label: 'Durée de la relance amiable', unit: 'jours' },
  formalNoticeDays: { label: 'Délai de la mise en demeure', unit: 'jours' },
  creditorApprovalDays: { label: 'Réponse du créancier à une proposition', unit: 'jours' },
  planCreditorApprovalDays: { label: 'Réponse du créancier à un échéancier hors barème', unit: 'jours' },
  disputeAnswerDays: { label: 'Réponse à une contestation', unit: 'jours' },
  prescriptionAlertDays: { label: 'Alerte avant la prescription', unit: 'jours' },
  debtorLinkDays: { label: 'Validité du lien envoyé au débiteur', unit: 'jours' },
  debtorSessionMinutes: { label: 'Session de l’espace du débiteur', unit: 'minutes' },
  remittanceBusinessDays: { label: 'Reversement au créancier', unit: 'jours ouvrés' },
  partnerSilenceAlertDays: { label: 'Alerte sans nouvelles d’un partenaire', unit: 'jours' },
  unrecoverableAfterMonths: { label: 'Dossier jugé irrécouvrable après', unit: 'mois' },
  closedCaseRetentionYears: { label: 'Conservation d’un dossier clôturé', unit: 'ans' },
};

export const SCALE_TITLES: Record<ScaleKey, string> = {
  defaultB2bScale: 'Barème des entreprises (B2B)',
  defaultB2cScale: 'Barème des particuliers (B2C)',
  defaultRentScale: 'Barème des loyers',
};

export const SCORE_TEXTS: Record<ScoreCriterion, string> = {
  debtAge: 'Ancienneté de la dette',
  writtenAcknowledgment: 'Reconnaissance écrite',
  evidenceQuality: 'Qualité des preuves',
  amount: 'Montant',
  validContacts: 'Coordonnées valides',
  partialPayments: 'Paiements partiels',
};

export const WEEK_DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'] as const;

export const settingsTexts = {
  nav: { label: 'Sections des réglages', general: 'Réglages', holidays: 'Jours fériés' },
  title: 'Réglages',
  lead: 'Délais, seuils, plage de contact, barèmes d’échéancier et score de recouvrabilité. Les dossiers en cours gardent les délais déjà calculés.',
  minimumCaseAmount: 'Montant dû minimal d’un dossier (F CFA)',
  delays: 'Délais et seuils',
  bounds: (min: number, max: number, unit: string) => `De ${min} à ${max} ${unit}.`,
  contact: {
    title: 'Plage de contact du débiteur',
    lead: 'Heure du Bénin. Hors de cette plage, un contact est refusé (RECOVERY_CONTACT_OUTSIDE_HOURS).',
    start: 'Début',
    end: 'Fin',
    days: 'Jours',
    noDay: 'Choisissez au moins un jour.',
    invalidTime: 'Heure attendue au format HH:MM.',
  },
  scales: {
    title: 'Barèmes d’échéancier par défaut',
    lead: 'Proposés par le chargé sans validation ; au-delà, l’échéancier passe par la validation d’un superviseur et du créancier.',
    accepts: 'Échéancier accepté',
    maxDurationMonths: 'Durée maximale (mois)',
    minFirstPayment: 'Premier versement minimal (% du dû)',
    firstPaymentWithinDays: 'Premier versement sous (jours)',
    minInstallment: 'Échéance minimale (F CFA)',
    maxDiscount: 'Remise maximale pour un paiement immédiat (%)',
  },
  score: {
    title: 'Score de recouvrabilité',
    lead: 'Poids de chaque critère, de 0 à 100 ; le service ramène la somme à 100.',
  },
  save: 'Enregistrer les réglages',
  saved: 'Réglages enregistrés.',
  readOnly: 'Lecture seule : les réglages sont modifiés par l’administration du Recouvrement.',
  holidays: {
    title: 'Jours fériés',
    lead: 'Jours fériés de l’année : ils sont exclus des jours ouvrés (lundi à vendredi) dans le calcul des délais.',
    year: 'Année',
    caption: (year: number) => `Jours fériés ${year}`,
    empty: (year: number) => `Aucun jour férié enregistré pour ${year}.`,
    date: 'Date',
    label: 'Libellé',
    add: 'Ajouter le jour',
    addTitle: 'Ajouter un jour férié',
    remove: 'Retirer',
    removeLabel: (label: string) => `Retirer ${label}`,
    weekend: 'Tombe un week-end : déjà hors des jours ouvrés.',
    duplicate: 'Ce jour est déjà dans la liste.',
    otherYear: (year: number) => `Choisissez un jour de ${year}.`,
    max: 'Quarante jours au plus par année.',
    save: 'Enregistrer la liste',
    saved: 'Jours fériés enregistrés.',
    unsaved: 'Modifications non enregistrées.',
    readOnly: 'Lecture seule : la liste est fixée par l’administration du Recouvrement.',
  },
} as const;
