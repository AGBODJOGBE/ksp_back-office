import type { BadgeTone } from '@/components/ui/badge';
import type { CustomerKind, RequestSort, RequestStatus } from './requests-schemas';

/** Textes des dossiers (demandes) du Nettoyage v2, sous-lot 1b. */

export const requestsTexts = {
  queue: {
    title: 'Dossiers',
    lead: 'Les demandes des clients : un dossier par lieu, de la demande au devis.',
    caption: 'Dossiers du Nettoyage',
    empty: 'Aucun dossier ne correspond à ces filtres.',
    emptyAll: 'Aucun dossier pour l’instant.',
    toDo: 'À traiter',
    toDoHint: 'Dossiers qui attendent une action de l’équipe.',
    showAll: 'Voir tous les dossiers',
    countUnknown: '—',
    filters: 'Filtres',
    number: 'Numéro de dossier',
    numberHint: 'Par exemple DN-000124.',
    search: 'Rechercher',
    status: 'Statut',
    customerKind: 'Clientèle',
    commune: 'Commune',
    place: 'Lieu',
    cleaningType: 'Type de nettoyage',
    from: 'Créés à partir du',
    to: 'Créés jusqu’au',
    sort: 'Tri',
    all: 'Tous',
    allFeminine: 'Toutes',
    clear: 'Effacer les filtres',
    customerFilter: 'Filtre sur un client précis actif.',
    organizationFilter: 'Filtre sur une organisation précise active.',
    tooLong: '50 caractères au plus.',
    columns: {
      number: 'Dossier',
      customer: 'Client',
      place: 'Lieu',
      types: 'Types',
      status: 'Statut',
      nextVisit: 'Prochaine visite',
      created: 'Créé le',
      next: 'À faire',
    },
    noVisit: 'Aucune',
    noName: 'Nom indisponible',
    waiting: 'En attente du client',
    closed: 'Dossier clos',
  },
  detail: {
    title: 'Fiche dossier',
    lead: 'Étapes du dossier, visites, constat retenu et devis.',
    coming:
      'Fiche dossier : refus, réactivation, correction de la position, visites, version retenue, devis et envoi.',
    back: 'Retour aux dossiers',
  },
} as const;

const STATUS: Record<RequestStatus, { label: string; tone: BadgeTone }> = {
  awaiting_visit_fee: { label: 'Frais de visite à payer', tone: 'neutral' },
  visit_to_schedule: { label: 'Visite à planifier', tone: 'warning' },
  visit_scheduled: { label: 'Visite planifiée', tone: 'brand' },
  visit_missed: { label: 'Client absent', tone: 'neutral' },
  visit_done: { label: 'Visite faite', tone: 'warning' },
  quote_sent: { label: 'Devis envoyé', tone: 'accent' },
  accepted: { label: 'Devis accepté', tone: 'success' },
  declined: { label: 'Devis décliné', tone: 'neutral' },
  expired: { label: 'Devis expiré', tone: 'neutral' },
  cancelled: { label: 'Annulé par le client', tone: 'neutral' },
  rejected: { label: 'Refusé par KSP', tone: 'danger' },
};

/** Libellé et ton d'un statut de dossier ; un statut inconnu garde sa valeur brute. */
export const requestStatus = (status: RequestStatus | string): { label: string; tone: BadgeTone } =>
  (STATUS as Record<string, { label: string; tone: BadgeTone }>)[status] ?? {
    label: status,
    tone: 'neutral',
  };

/**
 * Statuts qui attendent une action de l'équipe (partie 15.2) : planifier la visite, puis ajuster le
 * constat et composer le devis. `visit_missed` n'est qu'un passage vers `awaiting_visit_fee` (R-VI-05).
 * À valider : un devis expiré dont le client demande la réactivation (R-AC-04) n'est pas repérable
 * dans la liste (`reactivation` n'est que dans la fiche).
 */
export const ACTION_STATUSES = [
  'visit_to_schedule',
  'visit_done',
] as const satisfies readonly RequestStatus[];

const NEXT_STEP: Partial<Record<RequestStatus, string>> = {
  visit_to_schedule: 'Planifier la visite',
  visit_done: 'Ajuster le constat, composer le devis',
};
const WAITING: readonly RequestStatus[] = [
  'awaiting_visit_fee',
  'visit_scheduled',
  'visit_missed',
  'quote_sent',
];

/** Ce que l'équipe doit faire du dossier, ou pourquoi elle n'a rien à faire. */
export function nextStep(status: RequestStatus): { label: string; action: boolean } {
  const step = NEXT_STEP[status];
  if (step) return { label: step, action: true };
  const q = requestsTexts.queue;
  return { label: WAITING.includes(status) ? q.waiting : q.closed, action: false };
}

export const customerKindName = (kind: CustomerKind | string): string =>
  ({ individual: 'Particulier', organization: 'Entreprise' })[kind] ?? kind;

export const requestSortName = (sort: RequestSort): string =>
  ({
    '-createdAt': 'Plus récents d’abord',
    createdAt: 'Plus anciens d’abord',
    nextVisitAt: 'Prochaine visite',
  })[sort];
