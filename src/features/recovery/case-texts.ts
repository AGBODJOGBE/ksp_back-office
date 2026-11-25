import type { BadgeTone } from '@/components/ui/badge';
import { names } from './texts';

/** Libellés des valeurs du contrat lues sur un dossier. Un code inconnu retombe sur sa valeur brute. */

export const natureLabel = names({
  unpaid_invoice: 'Facture impayée',
  loan: 'Prêt',
  acknowledgment_of_debt: 'Reconnaissance de dette',
  bounced_cheque: 'Chèque impayé',
  service: 'Prestation',
  sale: 'Vente',
  rent: 'Loyer',
  other: 'Autre',
});

export const debtorRoleLabel = names({
  main: 'Débiteur principal',
  co_debtor: 'Codébiteur',
  guarantor: 'Caution',
});

export const rejectionLabel = names({
  prescribed: 'Créance prescrite',
  illegal: 'Créance illicite',
  no_evidence: 'Preuves insuffisantes',
  debtor_unreachable: 'Débiteur introuvable',
  other: 'Autre motif',
  incomplete: 'Complément non fourni dans le délai',
});

export const closureLabel = names({
  paid: 'Payé',
  settlement_executed: 'Remise exécutée',
  dispute_upheld: 'Contestation fondée',
  abandoned_by_creditor: 'Abandon par le créancier',
  unrecoverable: 'Irrécouvrable',
  prescribed: 'Prescrit',
});

export const planStatusLabel = names({
  proposed: 'Proposé',
  pending_creditor: 'Décision du créancier attendue',
  signed: 'Signé',
  completed: 'Soldé',
  defaulted: 'Défaillant',
  rejected: 'Refusé',
  cancelled: 'Annulé',
});

export const rhythmLabel = names({
  weekly: 'Chaque semaine',
  biweekly: 'Toutes les deux semaines',
  monthly: 'Chaque mois',
});

export const violationLabel = names({
  duration: 'Durée au-delà du barème',
  first_payment: 'Premier versement trop faible ou trop tardif',
  installment_minimum: 'Échéance sous le minimum',
});

export const installmentStatusLabel = names({
  upcoming: 'À venir',
  due: 'Due',
  paid: 'Payée',
  partial: 'Partielle',
  missed: 'Manquée',
});

export const promiseStatusLabel = names({
  pending: 'En attente',
  kept: 'Tenue',
  broken: 'Non tenue',
  cancelled: 'Annulée',
});

export const collectionSourceLabel = names({
  payment_link: 'Lien de paiement',
  offline_cash: 'Espèces',
  offline_transfer: 'Virement',
  partner: 'Partenaire',
  direct_to_creditor: 'Payé au créancier',
});

export const disputeReasonLabel = names({
  already_paid: 'Déjà payé',
  wrong_amount: 'Montant contesté',
  service_not_rendered: 'Prestation non rendue',
  wrong_person: 'Mauvaise personne',
  other: 'Autre',
});

export const disputeStatusLabel = names({
  open: 'Réponse du créancier attendue',
  creditor_answered: 'À trancher',
  upheld: 'Fondée',
  rejected: 'Rejetée',
  amount_corrected: 'Montant corrigé',
});

export const channelLabel = names({
  phone: 'Téléphone',
  sms: 'SMS',
  whatsapp: 'WhatsApp',
  email: 'E-mail',
  letter: 'Courrier',
  visit: 'Visite',
});

export const outcomeLabel = names({
  reached: 'Joint',
  no_answer: 'Sans réponse',
  wrong_number: 'Mauvais numéro',
  refused: 'Refus',
  promise: 'Promesse obtenue',
  callback_requested: 'Rappel demandé',
  delivered: 'Remis',
  failed: 'Échec',
});

export const directionLabel = names({ outbound: 'Sortant', inbound: 'Entrant' });

export const templateLabel = names({
  reminder: 'Relance',
  payment_link: 'Lien de paiement (renouvelé)',
  plan_reminder: 'Rappel de la prochaine échéance',
  callback_missed: 'Rappel manqué',
});

export const journalKindLabel = names({
  contact: 'Contact',
  message_sent: 'Message envoyé',
  letter: 'Courrier',
  promise: 'Promesse',
  payment: 'Paiement',
  plan: 'Échéancier',
  decision: 'Décision',
  stage_changed: 'Changement d’étape',
  status_changed: 'Changement d’état',
  dispute: 'Contestation',
  document: 'Pièce',
  partner_act: 'Acte du partenaire',
  note: 'Note interne',
  system: 'Service',
});

export const deliveryLabel = names({ sent: 'Envoyé', delivered: 'Remis', read: 'Lu', failed: 'Non remis' });

export const settlementStatusLabel = names({
  proposed: 'Proposée au débiteur',
  pending_creditor: 'Décision du créancier attendue',
  accepted: 'Acceptée',
  rejected: 'Refusée',
  executed: 'Exécutée',
  expired: 'Expirée',
});

/** Ton du badge d'état d'un dossier : ce qui attend une décision ressort. */
export const caseStatusTone = (status: string): BadgeTone =>
  (
    ({
      under_review: 'warning',
      info_requested: 'accent',
      awaiting_fee: 'neutral',
      active: 'action',
      suspended: 'warning',
      closed: 'success',
      rejected: 'danger',
    }) as Record<string, BadgeTone>
  )[status] ?? 'neutral';
