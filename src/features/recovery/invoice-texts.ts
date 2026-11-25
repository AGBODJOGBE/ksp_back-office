import type { BadgeTone } from '@/components/ui/badge';
import { names } from './texts';

/** Textes des factures de commission du recouvrement (ADR-064). */

const STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  pending_payment: { label: 'À régler', tone: 'warning' },
  paid: { label: 'Réglée', tone: 'action' },
  cancelled: { label: 'Annulée', tone: 'neutral' },
};
export const invoiceStatus = (code: string) => STATUS[code] ?? { label: code, tone: 'neutral' as const };

export const sourceLabel = names({
  payment_link: 'Lien de paiement',
  offline_cash: 'Espèces',
  offline_transfer: 'Virement',
  partner: 'Partenaire',
  direct_to_creditor: 'Payé au créancier',
});

export const settlementLabel = names({
  deducted: 'Retenue à l’encaissement',
  invoiced: 'Débitée du portefeuille',
});

export const failureLabel = names({
  insufficient_funds: 'Solde insuffisant',
  wallet_error: 'Erreur du portefeuille',
});

const month = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
/** « 2026-11 » → « novembre 2026 ». */
export function periodLabel(period: string): string {
  const [year, value] = period.split('-').map(Number);
  if (!year || !value) return period;
  return month.format(new Date(Date.UTC(year, value - 1, 15)));
}

export const invoiceTexts = {
  list: {
    title: 'Factures de commission',
    lead: 'Factures mensuelles de commission du recouvrement, une par créancier, avec l’état du débit automatique du portefeuille prépayé. Montants hors taxe.',
    caption: 'Factures de commission',
    empty: 'Aucune facture pour ces critères.',
    status: 'État',
    all: 'Tous',
    period: 'Mois facturé',
    periodHint: 'Mois et année, heure du Bénin.',
    columns: {
      number: 'Facture',
      creditor: 'Créancier',
      period: 'Mois',
      collected: 'Encaissé',
      commission: 'Commission HT',
      balance: 'Reste à régler',
      status: 'État',
    },
    debitFailed: (reason: string) => `Débit en échec : ${reason}`,
  },
  creditor: {
    account: 'Compte particulier',
    accountId: (id: string) => `Compte ${id}`,
  },
  detail: {
    back: 'Toutes les factures de commission',
    title: (number: string) => `Facture ${number}`,
    excludingTax: 'Montants hors taxe : aucune ligne de TVA.',
    creditor: 'Créancier',
    legalName: 'Raison sociale',
    address: 'Adresse',
    ifu: 'IFU',
    rccm: 'RCCM',
    period: 'Mois facturé',
    issuedAt: 'Émise le',
    paidAt: 'Réglée le',
    totals: 'Totaux (HT)',
    totalCollected: 'Total encaissé',
    commissionDeducted: 'Commission retenue à l’encaissement',
    commissionInvoiced: 'Commission à débiter du portefeuille',
    commissionTotal: 'Commission totale',
    balance: 'Reste à régler',
    debit: 'Débit automatique du portefeuille prépayé',
    noDebit: 'Aucune commission à débiter : la facture est réglée dès son émission.',
    attempts: 'Tentatives',
    lastAttemptAt: 'Dernier essai',
    lastFailure: 'Dernier échec',
    missing: 'Montant manquant',
    nextAttemptAt: 'Prochain essai',
    walletTransaction: 'Débit du portefeuille',
    lines: 'Encaissements',
    linesCaption: 'Encaissements facturés, par date',
    noLines: 'Aucun encaissement.',
    columns: {
      date: 'Date',
      case: 'Dossier',
      source: 'Origine',
      gross: 'Montant encaissé',
      commission: 'Commission HT',
      settlement: 'Règlement',
    },
    openCase: (number: string) => `Ouvrir le dossier ${number}`,
  },
} as const;
