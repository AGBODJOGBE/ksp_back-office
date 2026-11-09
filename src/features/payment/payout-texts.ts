import type { BadgeTone } from '@/components/ui/badge';

/** Textes des reversements par Mobile Money (ADR-041), module Finance. */

type StatusLabel = { label: string; tone: BadgeTone };

const statuses: Record<string, StatusLabel> = {
  requested: { label: 'Demandé', tone: 'warning' },
  processing: { label: 'En cours', tone: 'brand' },
  completed: { label: 'Terminé', tone: 'success' },
  failed: { label: 'En échec', tone: 'danger' },
};
export const payoutStatus = (code: string): StatusLabel => statuses[code] ?? { label: code, tone: 'neutral' };

const operators: Record<string, string> = { mtn: 'MTN', moov: 'Moov', celtiis: 'Celtiis' };
export const operatorName = (code: string) => operators[code] ?? code;

const providers: Record<string, string> = { manual: 'Manuel, virement par la finance', fedapay: 'FedaPay' };
export const payoutProvider = (code: string) => providers[code] ?? code;

export const payoutTexts = {
  title: 'Reversements',
  lead: 'Argent reversé par Mobile Money aux créanciers. En mode manuel, la finance fait elle-même le virement, puis le confirme avec sa référence ou le déclare en échec : le montant est alors rendu au créancier.',
  caption: 'Reversements par Mobile Money',
  loading: 'Chargement…',
  retry: 'Réessayer',
  loadMore: 'Afficher plus',
  loadingMore: 'Chargement de la suite…',
  all: 'Tous',
  status: 'État',
  empty: 'Aucun reversement pour le moment.',
  emptyFiltered: 'Aucun reversement dans cet état.',
  columns: {
    beneficiary: 'Bénéficiaire',
    amount: 'Montant',
    status: 'État',
    mode: 'Mode',
    created: 'Demandé le',
    action: 'Action',
  },
  call: (name: string) => `Appeler ${name}`,
  transfer: (reference: string) => `Virement : ${reference}`,
  failure: (reason: string) => `Raison : ${reason}`,
  completedOn: (date: string) => `Terminé le ${date}`,
  failedOn: (date: string) => `En échec le ${date}`,
  summary: (amount: string, name: string, phone: string, operator: string) =>
    `${amount} à ${name}, ${phone} (${operator}).`,
  cancel: 'Annuler',
  pending: 'Envoi…',
  confirm: {
    label: 'Confirmer le virement',
    accessibleLabel: (name: string) => `Confirmer le virement : ${name}`,
    title: 'Confirmer le virement fait',
    text: 'Confirmez seulement après avoir fait le virement Mobile Money. Le reversement sera terminé : cette action est définitive.',
    field: 'Référence du virement',
    hint: 'Référence donnée par l’opérateur, 100 caractères au plus.',
    required: 'Indiquez la référence du virement.',
    submit: 'Confirmer le reversement',
    done: (amount: string, name: string) => `Reversement de ${amount} à ${name} confirmé.`,
  },
  fail: {
    label: 'Déclarer en échec',
    accessibleLabel: (name: string) => `Déclarer en échec : ${name}`,
    title: 'Déclarer le reversement en échec',
    text: 'Le virement n’a pas pu être fait (numéro inconnu, compte bloqué…). Le montant sera rendu au solde du créancier : cette action est définitive.',
    field: 'Raison',
    hint: 'Obligatoire, 500 caractères au plus. Gardée par la finance, jamais envoyée au créancier.',
    required: 'Indiquez la raison.',
    submit: 'Déclarer en échec',
    done: (amount: string, name: string) =>
      `Reversement de ${amount} à ${name} déclaré en échec : le montant est rendu au créancier.`,
  },
} as const;
