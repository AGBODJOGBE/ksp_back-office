import type { BadgeTone } from '@/components/ui/badge';

/** Textes des paiements en ligne du back-office (module Finance). */

export const paymentPaths = {
  list: '/finance/paiements',
  /** Paiements d'un objet (mission ou facture), depuis sa fiche. */
  forSubject: (id: string) => `/finance/paiements?objet=${encodeURIComponent(id)}`,
  /** Écarts de montant pas encore traités (`underReview=true`). */
  toReview: '/finance/paiements?a-examiner=1',
} as const;

type StatusLabel = { label: string; tone: BadgeTone };

export const paymentStatuses: Record<string, StatusLabel> = {
  /** Le statut reste `amount_mismatch` une fois l'écart traité : « à examiner » se lit dans `underReview`. */
  amount_mismatch: { label: 'Montant différent', tone: 'danger' },
  pending: { label: 'En attente', tone: 'warning' },
  succeeded: { label: 'Réussi', tone: 'success' },
  failed: { label: 'Refusé', tone: 'neutral' },
  expired: { label: 'Expiré', tone: 'neutral' },
  cancelled: { label: 'Abandonné', tone: 'neutral' },
};

export function paymentStatus(status: string): StatusLabel {
  return paymentStatuses[status] ?? { label: status, tone: 'neutral' };
}

const subjectTypes: Record<string, string> = {
  cleaning_mission: 'Mission',
  billing_invoice: 'Facture',
  wallet_top_up: 'Recharge du portefeuille',
};
export const subjectType = (code: string) => subjectTypes[code] ?? code;

const parts: Record<string, string> = { deposit: 'acompte', balance: 'reste dû' };
const providers: Record<string, string> = { fedapay: 'FedaPay', simulated: 'Simulé (développement)' };
export const providerName = (code: string) => providers[code] ?? code;

const failures: Record<string, string> = {
  declined: 'refusé par le prestataire',
  cancelled: 'abandonné sur la page de paiement',
  expired: 'délai dépassé',
};
export const failureReason = (code: string) => failures[code] ?? code;

/** « Mission du Nettoyage, acompte », « Facture FAC-2026-000012 ». */
export function subjectLabel(subject: { type: string; part: string | null; reference: string | null }) {
  if (subject.type === 'billing_invoice') {
    return subject.reference ? `Facture ${subject.reference}` : 'Facture';
  }
  if (subject.type === 'wallet_top_up') return 'Recharge du portefeuille';
  if (subject.type === 'cleaning_mission') {
    const part = subject.part ? parts[subject.part] : null;
    return part ? `Mission du Nettoyage, ${part}` : 'Mission du Nettoyage';
  }
  return subjectType(subject.type);
}

export const paymentTexts = {
  title: 'Paiements en ligne',
  lead: 'Paiements Mobile Money des clients : missions, factures et recharges de portefeuille. Un paiement « à examiner » a été approuvé pour un autre montant : rien n’a été enregistré, la finance tranche.',
  caption: 'Paiements en ligne',
  loading: 'Chargement…',
  retry: 'Réessayer',
  loadMore: 'Afficher plus',
  loadingMore: 'Chargement de la suite…',
  all: 'Tous',
  status: 'État',
  subjectType: 'Objet payé',
  filters: 'Filtres en cours',
  bySubject: 'Objet sélectionné',
  removeFilter: (label: string) => `Retirer le filtre « ${label} »`,
  empty: 'Aucun paiement en ligne pour le moment.',
  emptyFiltered: 'Aucun paiement ne correspond à ces filtres.',
  toReview:
    'Des paiements en ligne sont à examiner : le prestataire a approuvé un autre montant que celui dû.',
  toReviewLink: 'Voir les paiements à examiner',
  toReviewHint:
    'Rien n’a été enregistré sur la mission ou la facture. Vérifiez la transaction chez le prestataire avec sa référence, puis enregistrez le règlement à la main ou remboursez le client.',
  columns: {
    subject: 'Objet payé',
    status: 'État',
    amount: 'Montant',
    payer: 'Payeur',
    provider: 'Prestataire',
    created: 'Créé le',
    completed: 'Terminé le',
  },
  individual: 'Particulier',
  business: 'Entreprise',
  seeOrganization: 'Voir l’entreprise',
  seeWallet: 'Portefeuille du payeur',
  seeWalletOf: (subject: string) => `Portefeuille du payeur : ${subject}`,
  noReference: 'sans référence',
  reference: (value: string) => `Réf. ${value}`,
  failure: (reason: string) => `Motif : ${reason}`,
  expiresAt: (date: string) => `Expire le ${date}`,
  notCompleted: 'Pas encore',
  queue: {
    title: 'Écarts de paiement',
    description:
      'Paiements approuvés pour un autre montant, pas encore traités : ils bloquent les nouveaux paiements de leur mission ou facture.',
    seeAll: 'Voir tous les écarts à examiner',
  },
  underReviewFilter: 'À examiner',
  underReview: 'À examiner',
  resolvedOn: (date: string) => `Écart traité le ${date}`,
  resolutionNote: (note: string) => `Note : ${note}`,
  actionColumn: 'Action',
  resolve: {
    label: 'Traiter l’écart',
    accessibleLabel: (subject: string) => `Traiter l’écart : ${subject}`,
    title: 'Traiter l’écart de montant',
    summary: (subject: string, amount: string) => `${subject}, ${amount} attendus.`,
    text: 'Le prestataire a approuvé un autre montant ou une autre devise : rien n’a été enregistré sur la mission ou la facture. Indiquez ce que vous avez fait (remboursement, encaissement enregistré à la main…). Cette action n’enregistre aucun montant.',
    field: 'Ce qui a été fait',
    hint: 'Obligatoire, 500 caractères au plus.',
    required: 'Indiquez ce qui a été fait.',
    confirm: 'Enregistrer le traitement',
    pending: 'Envoi…',
    cancel: 'Annuler',
    done: (subject: string) =>
      `Écart traité pour ${subject}. Le paiement n’est plus à examiner et ne bloque plus les nouveaux paiements de cet objet.`,
    /** Recharge du portefeuille : rien n'est crédité tant que la finance ne crédite pas le montant reçu. */
    topUpNext:
      'Pour une recharge, créditez maintenant le montant réellement reçu depuis le portefeuille du client.',
  },
} as const;
