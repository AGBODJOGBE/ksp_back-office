/** Textes communs du Recouvrement. Un code inconnu retombe sur sa valeur brute. */

export const names =
  <K extends string>(entries: Record<K, string>) =>
  (code: K | string): string =>
    (entries as Record<string, string>)[code] ?? code;

/** Taux en points de base (1 000 = 10 %) → « 12,5 % ». */
const percent = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
export const formatBps = (bps: number): string => `${percent.format(bps / 100)} %`;

export const stageLabel = names({
  notice: 'Notification',
  payment_plan: 'Échéancier',
  amicable: 'Relance amiable',
  formal_notice: 'Mise en demeure',
  bailiff: 'Huissier',
  litigation: 'Judiciaire',
});

export const stageGroupLabel = names({
  amicable: 'À l’amiable',
  formal_notice: 'Après mise en demeure',
  litigation: 'Au contentieux',
});

export const kindLabel = names({ b2b: 'Entreprises (B2B)', b2c: 'Particuliers (B2C)', rent: 'Loyers' });

export const caseStatusLabel = names({
  draft: 'Brouillon',
  awaiting_fee: 'Frais à payer',
  under_review: 'Recevabilité à décider',
  info_requested: 'Complément demandé',
  active: 'En cours',
  suspended: 'Suspendu',
  closed: 'Clôturé',
  rejected: 'Irrecevable',
});

export const deadlineLabel = names({
  notice_response: 'Réponse à la notification',
  plan_installment: 'Échéance de l’échéancier',
  amicable_end: 'Fin de la relance amiable',
  formal_notice_end: 'Fin de la mise en demeure',
  creditor_decision: 'Décision du créancier',
  dispute_answer: 'Réponse à une contestation',
  fee_payment: 'Paiement des frais',
  info_completion: 'Complément du dossier',
  review: 'Recevabilité',
  prescription: 'Prescription',
  promise: 'Promesse de paiement',
  partner_update: 'Nouvelles du partenaire',
});

export const recoveryTexts = {
  module: 'Recouvrement',
  tabs: {
    label: 'Sections du Recouvrement',
    overview: 'Tableau de bord',
    cases: 'Dossiers',
    offlinePayments: 'Paiements hors ligne',
    pricing: 'Tarification',
    invoices: 'Factures de commission',
    settings: 'Réglages',
  },
  common: {
    loading: 'Chargement…',
    retry: 'Réessayer',
    cancel: 'Annuler',
    sending: 'Envoi…',
    saving: 'Enregistrement…',
    save: 'Enregistrer',
    saved: 'Modifications enregistrées.',
    loadMore: 'Afficher plus',
    loadingMore: 'Chargement de la suite…',
    reference: (id: string) => `Référence pour le support : ${id}.`,
    genericError: 'Une erreur est survenue. Réessayez dans quelques instants.',
    required: 'Champ obligatoire.',
    invalidInteger: 'Saisissez un nombre entier.',
    invalidAmount: 'Saisissez un montant en francs CFA, sans décimales.',
    invalidPercent: 'Saisissez un pourcentage de 0 à 100, deux décimales au plus (par exemple 12,5).',
    between: (min: number, max: number) => `Entre ${min} et ${max}.`,
    tooLong: (max: number) => `${max} caractères au plus.`,
    fixErrors: 'Corrigez les champs signalés.',
    someone: 'un membre de l’équipe',
    system: 'le service',
    updated: (date: string, name: string) => `Modifié le ${date} par ${name}`,
    never: 'Jamais modifié : valeurs par défaut du service.',
    none: 'Aucun',
    yes: 'Oui',
    no: 'Non',
    actions: 'Actions',
    forbidden: 'Votre rôle ne donne pas accès à cet écran.',
    notFound: 'Élément introuvable : il a peut-être été retiré, ou l’adresse est incomplète.',
    mfaHint:
      'Publier, valider, archiver et modifier les réglages exigent une double authentification de moins de 10 minutes : reconnectez-vous si la gateway le demande.',
  },
  /** Écrans livrés avec le sous-lot suivant (dossiers, paiements hors ligne). */
  pending: {
    title: 'Arrive avec le sous-lot 4b',
    cases:
      'La file des dossiers et la fiche dossier (recevabilité, affectation, contacts, promesses, échéanciers, remises, étapes, journal) arrivent avec le prochain sous-lot.',
    offlinePayments:
      'La file des paiements hors ligne à valider (espèces, virements saisis par un chargé) arrive avec le prochain sous-lot.',
    caseDetail: 'La fiche dossier arrive avec le prochain sous-lot.',
    back: 'Revenir au tableau de bord',
  },
} as const;

/** Nom affichable d'un acteur (`RecoveryActor`) : son nom, ou une mention neutre. */
export function actorName(actor: { type: string; displayName: string | null } | null): string {
  if (!actor) return recoveryTexts.common.someone;
  if (actor.displayName?.trim()) return actor.displayName.trim();
  return actor.type === 'system' ? recoveryTexts.common.system : recoveryTexts.common.someone;
}
