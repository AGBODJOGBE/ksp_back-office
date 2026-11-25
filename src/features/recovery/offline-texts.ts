import type { BadgeTone } from '@/components/ui/badge';
import { names } from './texts';

/** Textes de la file des paiements hors ligne et de sa section dans Ma journée. */
export const offlineTexts = {
  title: 'Paiements hors ligne',
  lead: 'Espèces au guichet et virements saisis par la finance, encaissements déclarés par les partenaires. Un paiement n’est imputé au dossier et crédité au créancier qu’une fois validé par une autre personne que l’auteur de la saisie.',
  status: 'État',
  all: 'Tous',
  caption: 'Paiements hors ligne',
  empty: 'Aucun paiement pour ces critères.',
  columns: {
    case: 'Dossier',
    amount: 'Montant',
    source: 'Origine',
    received: 'Reçu le',
    reference: 'Référence',
    recordedBy: 'Saisi par',
    status: 'État',
    actions: 'Actions',
  },
  open: (number: string) => `Ouvrir le dossier ${number}`,
  noReference: 'Aucune',
  approve: 'Valider',
  approveLabel: (number: string, amount: string) => `Valider le paiement de ${amount} du dossier ${number}`,
  approveTitle: 'Valider le paiement hors ligne',
  approveText: (amount: string, number: string) =>
    `${amount} sera imputé au dossier ${number} : commission calculée et net crédité au créancier.`,
  reject: 'Refuser',
  rejectLabel: (number: string, amount: string) => `Refuser le paiement de ${amount} du dossier ${number}`,
  rejectTitle: 'Refuser le paiement hors ligne',
  rejectText: 'Le paiement ne sera pas imputé. Le motif est inscrit au journal du dossier.',
  reason: 'Motif du refus',
  reasonHint: 'De 3 à 1 000 caractères.',
  reasonLength: 'Saisissez un motif de 3 à 1 000 caractères.',
  own: 'Vous avez saisi ce paiement : sa validation revient à une autre personne.',
  approved: (amount: string, net: string) =>
    `Paiement validé : ${amount} imputé, ${net} crédité au créancier.`,
  rejected: 'Paiement refusé.',
  rejectionReason: (reason: string) => `Motif : ${reason}`,
  approvedBy: (name: string) => `Validé par ${name}`,
  mfa: 'Valider et refuser exigent une double authentification de moins de 10 minutes : reconnectez-vous si la gateway le demande.',
  queue: {
    title: 'Paiements hors ligne à valider',
    description: 'Espèces et virements saisis par la finance, encaissements déclarés par les partenaires.',
    seeAll: 'Voir les paiements',
    open: 'Valider ou refuser',
    row: (amount: string, number: string) => `${amount} — dossier ${number}`,
    received: (date: string) => `Reçu le ${date}`,
    by: (name: string) => `Saisi par ${name}`,
  },
} as const;

export const offlineSourceLabel = names({
  cash: 'Espèces au guichet',
  transfer: 'Virement',
  partner: 'Déclaré par un partenaire',
});

export const offlineStatus = (status: string): { label: string; tone: BadgeTone } =>
  ({
    pending_approval: { label: 'À valider', tone: 'warning' as const },
    approved: { label: 'Validé', tone: 'success' as const },
    rejected: { label: 'Refusé', tone: 'danger' as const },
  })[status] ?? { label: status, tone: 'neutral' };
