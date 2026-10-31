import type { BadgeTone } from '@/components/ui/badge';

/** Textes du module Nettoyage du back-office. Les libellés d'états inconnus retombent sur le code brut. */

type Labelled = Record<string, { label: string; tone: BadgeTone }>;

export const requestStatuses: Labelled = {
  received: { label: 'Reçue', tone: 'accent' },
  visit_scheduled: { label: 'Visite planifiée', tone: 'brand' },
  quote_sent: { label: 'Devis envoyé', tone: 'brand' },
  accepted: { label: 'Acceptée', tone: 'success' },
  declined: { label: 'Devis refusé par le client', tone: 'neutral' },
  rejected: { label: 'Refusée', tone: 'danger' },
  expired: { label: 'Expirée', tone: 'neutral' },
  cancelled: { label: 'Annulée', tone: 'neutral' },
};

export const missionStatuses: Labelled = {
  to_schedule: { label: 'À planifier', tone: 'accent' },
  scheduled: { label: 'Planifiée', tone: 'brand' },
  in_progress: { label: 'En cours', tone: 'warning' },
  on_hold: { label: 'En attente', tone: 'danger' },
  completed: { label: 'Terminée', tone: 'success' },
  cancelled: { label: 'Annulée', tone: 'neutral' },
};

export const interventionStatuses: Labelled = {
  planned: { label: 'Prévu', tone: 'brand' },
  in_progress: { label: 'En cours', tone: 'warning' },
  on_hold: { label: 'En attente (incident)', tone: 'danger' },
  completed: { label: 'Terminé', tone: 'success' },
  cancelled: { label: 'Annulé', tone: 'neutral' },
};

export const visitStatuses: Labelled = {
  scheduled: { label: 'Planifiée', tone: 'brand' },
  completed: { label: 'Réalisée', tone: 'success' },
  cancelled: { label: 'Annulée', tone: 'neutral' },
};

export const paymentStatuses: Labelled = {
  due: { label: 'À régler', tone: 'warning' },
  deposit_received: { label: 'Acompte reçu', tone: 'brand' },
  paid: { label: 'Réglé', tone: 'success' },
};

const names = (entries: Record<string, string>) => (code: string) => entries[code] ?? code;

export const customerKind = names({ individual: 'Particulier', business: 'Entreprise' });
export const premisesType = names({
  apartment: 'Appartement',
  house: 'Maison',
  office: 'Bureaux',
  shop: 'Commerce',
  warehouse: 'Entrepôt',
  other: 'Autre',
});
export const UNITS = {
  square_meter: 'm²',
  room: 'pièce',
  septic_tank: 'fosse',
  cubic_meter: 'm³',
} as const;
export const unitName = names(UNITS);
export const paymentMethod = names({
  cash: 'Espèces',
  mobile_money_offline: 'Mobile Money (hors ligne)',
  mobile_money_online: 'Mobile Money (en ligne)',
});
export const paymentOption = names({ deposit: 'Acompte', full: 'Totalité' });
export const paymentTiming = names({ before: 'avant la prestation', after: 'après la prestation' });
const plural = (count: number, one: string, many: string) => `${count} ${count > 1 ? many : one}`;

/**
 * Causes actives d'une suspension (ADR-030), la plus ancienne d'abord, en clair : « Compte entreprise
 * suspendu par KSP », « 2 factures impayées ». Le nombre d'impayés est celui de la dernière décision.
 */
export function suspensionCauses(suspension: { causes: string[]; unpaidCount: number }): string[] {
  const count = suspension.unpaidCount;
  return suspension.causes.map((cause) => {
    if (cause === 'organization_suspended') return 'Compte entreprise suspendu par KSP';
    if (cause === 'unpaid_invoices')
      return count ? plural(count, 'facture impayée', 'factures impayées') : 'Factures impayées';
    if (cause === 'unpaid_interventions')
      return count ? plural(count, 'passage impayé', 'passages impayés') : 'Passages impayés';
    return cause;
  });
}

/** Nom affiché lu dans identity, ou libellé court quand il manque (`null` : inconnu ou identity indisponible). */
export function nameOr(name: string | null | undefined, fallback: string): string {
  return name?.trim() || fallback;
}

/** Client d'une demande ou d'une mission : raison sociale de l'organisation, sinon nom du compte. */
export function customerLabel(item: {
  customerKind?: string;
  customerName?: string | null;
  organizationName?: string | null;
}): string {
  if (item.organizationName) return item.organizationName;
  return nameOr(
    item.customerName,
    item.customerKind === 'business' ? cleaningTexts.common.unnamedBusiness : cleaningTexts.common.unnamed,
  );
}

export function recurrenceText(recurrence: {
  period: string;
  visitsPerPeriod: number;
  durationMonths: number;
}) {
  const period =
    recurrence.period === 'week' ? 'semaine' : recurrence.period === 'month' ? 'mois' : recurrence.period;
  return `${recurrence.visitsPerPeriod} passage${recurrence.visitsPerPeriod > 1 ? 's' : ''} par ${period}, pendant ${recurrence.durationMonths} mois`;
}

export const cleaningTexts = {
  module: 'Nettoyage',
  tabs: {
    label: 'Sections du Nettoyage',
    requests: 'Demandes',
    missions: 'Missions',
    catalog: 'Catalogue',
    zones: 'Zones',
    team: 'Agents et équipes',
  },
  common: {
    loading: 'Chargement…',
    retry: 'Réessayer',
    cancel: 'Annuler',
    close: 'Fermer',
    sending: 'Envoi…',
    saving: 'Enregistrement…',
    save: 'Enregistrer',
    loadMore: 'Afficher plus',
    loadingMore: 'Chargement de la suite…',
    reference: (id: string) => `Référence pour le support : ${id}.`,
    genericError: 'Une erreur est survenue. Réessayez dans quelques instants.',
    reasonLabel: 'Motif',
    reasonRequired: 'Indiquez un motif.',
    required: 'Champ obligatoire.',
    invalidNumber: 'Saisissez un nombre entier.',
    invalidDate: 'Choisissez une date et une heure.',
    saved: 'Enregistré.',
    back: 'Retour',
    none: 'Aucun',
    unknownAgent: 'Agent non rattaché',
    unnamed: 'Client sans nom',
    unnamedBusiness: 'Entreprise sans nom',
    someone: 'un membre de l’équipe',
    beninTime: 'Heure du Bénin.',
    all: 'Tous',
    allFeminine: 'Toutes',
    details: 'Détails',
    actions: 'Actions',
  },
  /** Refus de la gateway dont les détails précisent la suite (voir `errors.ts`). */
  errors: {
    interventionTooEarly: (date: string) =>
      `Ce passage est prévu le ${date} : il pourra être démarré à partir de ce jour (heure du Bénin).`,
    visitTooEarly: (date: string) =>
      `La visite est prévue le ${date} : son compte rendu pourra être saisi à partir de cette heure.`,
    paymentExceeds: (due: string) => `Ce montant dépasse le reste dû. Reste dû : ${due}.`,
    paymentSettled: 'Cette mission est déjà entièrement payée : aucun paiement de plus n’est possible.',
    organizationSuspended:
      'Ce compte entreprise est suspendu par KSP : rien de nouveau ne peut être fait en son nom avant sa réactivation.',
  },
} as const;

export function statusOf(map: Labelled, code: string): { label: string; tone: BadgeTone } {
  return map[code] ?? { label: code, tone: 'neutral' };
}
