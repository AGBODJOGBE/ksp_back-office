import type { BadgeTone } from '@/components/ui/badge';

/** Textes des paiements en ligne du back-office (module Finance). */

export const paymentPaths = {
  list: '/finance/paiements',
  /** Paiements d'un objet (mission ou facture), depuis sa fiche. */
  forSubject: (id: string) => `/finance/paiements?objet=${encodeURIComponent(id)}`,
  toReview: '/finance/paiements?etat=amount_mismatch',
} as const;

type StatusLabel = { label: string; tone: BadgeTone };

export const paymentStatuses: Record<string, StatusLabel> = {
  amount_mismatch: { label: 'À examiner (montant différent)', tone: 'danger' },
  pending: { label: 'En attente', tone: 'warning' },
  succeeded: { label: 'Réussi', tone: 'success' },
  failed: { label: 'Refusé', tone: 'neutral' },
  expired: { label: 'Expiré', tone: 'neutral' },
  cancelled: { label: 'Abandonné', tone: 'neutral' },
};

export function paymentStatus(status: string): StatusLabel {
  return paymentStatuses[status] ?? { label: status, tone: 'neutral' };
}

const subjectTypes: Record<string, string> = { cleaning_mission: 'Mission', billing_invoice: 'Facture' };
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
  if (subject.type === 'cleaning_mission') {
    const part = subject.part ? parts[subject.part] : null;
    return part ? `Mission du Nettoyage, ${part}` : 'Mission du Nettoyage';
  }
  return subjectType(subject.type);
}

export const paymentTexts = {
  title: 'Paiements en ligne',
  lead: 'Paiements Mobile Money des clients, par mission ou par facture. Un paiement « à examiner » a été approuvé pour un autre montant : rien n’a été enregistré, la finance tranche.',
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
  noReference: 'sans référence',
  reference: (value: string) => `Réf. ${value}`,
  failure: (reason: string) => `Motif : ${reason}`,
  expiresAt: (date: string) => `Expire le ${date}`,
  notCompleted: 'Pas encore',
} as const;
