import type { BadgeTone } from '@/components/ui/badge';

/** Textes de la facturation du back-office (module Finance). Un état inconnu retombe sur son code brut. */

export const billingPaths = {
  invoices: '/finance/factures',
  invoice: (id: string) => `/finance/factures/${encodeURIComponent(id)}`,
  settings: '/finance/reglages',
} as const;

type StatusLabel = { label: string; tone: BadgeTone };

export const invoiceStatuses: Record<string, StatusLabel> = {
  pending_payment: { label: 'En attente de paiement', tone: 'warning' },
  overdue: { label: 'Impayée', tone: 'danger' },
  paid: { label: 'Payée', tone: 'success' },
  cancelled: { label: 'Annulée', tone: 'neutral' },
};

export function invoiceStatus(status: string): StatusLabel {
  return invoiceStatuses[status] ?? { label: status, tone: 'neutral' };
}

const methods: Record<string, string> = {
  cash: 'Espèces',
  bank_transfer: 'Virement',
  mobile_money_offline: 'Mobile Money (hors ligne)',
  /** Paiement en ligne confirmé par le prestataire (`recordedBy` = `system`, ADR-031). */
  mobile_money_online: 'Mobile Money en ligne',
};

export const invoiceMethod = (code: string) => methods[code] ?? code;

const sources: Record<string, string> = { cleaning: 'Nettoyage' };
export const invoiceSource = (code: string) => sources[code] ?? code;

export const billingTexts = {
  common: {
    loading: 'Chargement…',
    retry: 'Réessayer',
    cancel: 'Annuler',
    sending: 'Envoi…',
    saving: 'Enregistrement…',
    loadMore: 'Afficher plus',
    loadingMore: 'Chargement de la suite…',
    all: 'Tous',
  },
  invoices: {
    title: 'Factures',
    lead: 'Factures mensuelles des contrats d’entreprise : échéance, règlements reçus, reste dû.',
    caption: 'Factures',
    empty: 'Aucune facture pour le moment. Elles sont émises chaque mois pour les contrats d’entreprise.',
    emptyFiltered: 'Aucune facture ne correspond à ces filtres.',
    status: 'État',
    filters: 'Filtres en cours',
    byOrganization: 'Entreprise sélectionnée',
    byContract: 'Mission sélectionnée',
    removeFilter: (label: string) => `Retirer le filtre « ${label} »`,
    columns: {
      number: 'Facture',
      status: 'État',
      billedTo: 'Facturé à',
      period: 'Période',
      dueAt: 'Échéance',
      total: 'Total',
      balance: 'Reste dû',
    },
    individual: 'Particulier',
    unknownHeader: 'Entreprise (en-tête non enregistré)',
    period: (start: string, end: string) => `du ${start} au ${end}`,
    month: (index: number) => `Mois ${index}`,
  },
  invoice: {
    back: 'Retour aux factures',
    title: (number: string) => `Facture ${number}`,
    notFound: 'Cette facture est introuvable.',
    period: (start: string, end: string) => `Période du ${start} au ${end}`,
    overdue:
      'Facture impayée : son échéance est passée. Au-delà du seuil d’impayés, le contrat est suspendu, puis reprend au règlement.',
    pending: (date: string) => `À régler avant le ${date}.`,
    cancelled: 'Facture annulée (correction) : elle n’est plus à régler.',
    billedTo: 'Facturé à',
    noHeader:
      'Aucun en-tête d’entreprise : facture d’un particulier, ou émise avant l’enregistrement de l’en-tête.',
    headerFrozen:
      'En-tête enregistré à l’émission : une modification ultérieure de la fiche ne le change pas.',
    ifu: 'IFU',
    rccm: 'RCCM',
    seeOrganization: 'Voir le compte entreprise',
    linesTitle: 'Détail',
    linesCaption: 'Lignes de la facture',
    line: 'Libellé',
    quantity: 'Quantité',
    unitPrice: 'Prix unitaire',
    amount: 'Montant',
    prorata:
      'Montant établi par le service de facturation au prorata des jours facturables du mois : premier et dernier mois partiels, jours de suspension déduits.',
    summaryTitle: 'Montants et échéance',
    source: 'Origine',
    contract: 'Contrat',
    seeMission: 'Voir la mission',
    monthLabel: 'Mois facturé',
    month: (index: number) => `Mois ${index} du contrat`,
    issuedAt: 'Émise le',
    dueAt: 'Échéance',
    paidAt: 'Réglée le',
    total: 'Total',
    paid: 'Déjà réglé',
    balance: 'Reste dû',
    paymentsTitle: 'Règlements reçus',
    paymentsCaption: 'Règlements de la facture',
    noPayments: 'Aucun règlement enregistré pour le moment.',
    onlinePayments: 'Paiements en ligne de cette facture',
    columns: {
      date: 'Date',
      amount: 'Montant',
      method: 'Moyen',
      reference: 'Référence',
      by: 'Enregistré par',
    },
    bySystem: 'Paiement en ligne (automatique)',
    byStaff: 'Équipe KSP',
    noReference: 'Aucune',
  },
  pay: {
    label: 'Enregistrer un paiement',
    title: 'Enregistrer un paiement reçu',
    text: (balance: string) =>
      `Paiement reçu hors ligne (espèces, virement, Mobile Money). Paiement partiel accepté, jamais au-delà du reste dû : ${balance}.`,
    amount: 'Montant reçu (FCFA)',
    amountHint: 'Entier, sans espaces ni décimales.',
    method: 'Moyen de paiement',
    reference: 'Référence (facultatif)',
    referenceHint: 'Numéro du virement ou de la transaction, par exemple VIR-2026-1215.',
    confirm: 'Enregistrer le paiement',
    invalidAmount: 'Saisissez un montant entier supérieur à zéro.',
    done: (amount: string) => `Paiement de ${amount} enregistré.`,
  },
  settings: {
    title: 'Réglages de la facturation',
    lead: 'Délai de règlement des factures après leur émission.',
    termTitle: 'Délai de règlement',
    term: 'Délai de règlement (jours)',
    termHint:
      'Entre 1 et 90 jours. S’applique aux factures émises ensuite ; les échéances déjà fixées ne changent pas.',
    current: (days: number) => `Délai actuel : ${days} jour${days > 1 ? 's' : ''} après l’émission.`,
    updated: (date: string) => `Modifié le ${date}.`,
    neverUpdated: 'Valeur par défaut, jamais modifiée.',
    save: 'Enregistrer',
    saved: 'Réglage enregistré.',
    invalid: 'Saisissez un nombre entier de jours entre 1 et 90.',
    thresholdsTitle: 'Seuils d’avertissement et de suspension',
    thresholds:
      'Les seuils d’impayés (avertissement, suspension des contrats) sont des réglages du Nettoyage, qui suit les factures impayées de chaque mission.',
    thresholdsLink: 'Ouvrir les réglages du Nettoyage',
    thresholdsNoAccess: 'Ils se modifient dans le module Nettoyage, par son administrateur.',
    forbidden:
      'Les réglages de la facturation sont réservés à la finance et à l’administration du Nettoyage.',
  },
  errors: {
    exceedsBalance: (balance: string) => `Montant supérieur au reste dû (${balance}).`,
    amountInvalid: 'Montant refusé : saisissez un entier supérieur à zéro.',
    methodNotAllowed: 'Ce moyen de paiement n’est pas accepté pour une facture.',
    invalidTransition: 'Cette facture est déjà payée ou annulée : la fiche a été actualisée.',
    concurrent:
      'La facture vient d’être modifiée par ailleurs : la fiche a été actualisée, vérifiez le reste dû.',
  },
} as const;
