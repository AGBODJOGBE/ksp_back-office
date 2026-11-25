import type { BadgeTone } from '@/components/ui/badge';
import type { Claim, ClaimCategory, ClaimOutcome, ClaimSort, ClaimStatus } from './claims-schemas';

/** Textes des réclamations du Nettoyage v2, sous-lot 1c-4 : file, fiche, échanges et décision. */

type Status = { label: string; tone: BadgeTone };

const STATUSES: Record<ClaimStatus, Status> = {
  open: { label: 'Nouvelle', tone: 'warning' },
  in_progress: { label: 'En cours', tone: 'brand' },
  resolved: { label: 'Résolue', tone: 'success' },
  rejected: { label: 'Rejetée', tone: 'neutral' },
};

const CATEGORIES: Record<ClaimCategory, string> = {
  incomplete_work: 'Travail incomplet',
  damage: 'Dégât',
  behavior: 'Comportement',
  missing_item: 'Objet manquant',
  other: 'Autre',
};

const OUTCOMES: Record<ClaimOutcome, string> = {
  free_redo: 'Repasse gratuite',
  wallet_credit: 'Crédit',
  rejected: 'Rejet',
};

const SORTS: Record<ClaimSort, string> = {
  openedAt: 'Plus anciennes d’abord',
  '-openedAt': 'Plus récentes d’abord',
};

export const claimStatus = (status: ClaimStatus): Status => STATUSES[status];
export const claimCategory = (category: ClaimCategory) => CATEGORIES[category];
export const claimOutcome = (outcome: ClaimOutcome) => OUTCOMES[outcome];
export const claimSortName = (sort: ClaimSort) => SORTS[sort];

/** Objectif de première réponse (contrat : `firstResponseAt`, « Objectif : 24 h »). */
export const FIRST_RESPONSE_HOURS = 24;

/** Réclamation ouverte sans réponse depuis plus de 24 h (à l'instant `now`, en millisecondes). */
export function responseLate(claim: Pick<Claim, 'status' | 'firstResponseAt' | 'openedAt'>, now: number) {
  if (claim.firstResponseAt || (claim.status !== 'open' && claim.status !== 'in_progress')) return false;
  return now - Date.parse(claim.openedAt) > FIRST_RESPONSE_HOURS * 3600_000;
}

/** Prochain geste attendu du personnel, d'après le statut et la décision (R-RC-02, R-RC-03). */
export function claimNextStep(claim: Pick<Claim, 'status' | 'decision'>): { label: string; action: boolean } {
  if (claim.status === 'open') return { label: 'Prendre en charge', action: true };
  if (claim.status !== 'in_progress') return { label: 'Rien à faire', action: false };
  if (!claim.decision) return { label: 'Décider', action: true };
  if (claim.decision.approvalStatus === 'pending') return { label: 'Crédit à valider', action: true };
  return { label: 'En attente du service', action: false };
}

/** Nom du client : organisation ou particulier (rempli pour le personnel seulement). */
export const claimCustomer = (claim: Pick<Claim, 'organizationName' | 'customerName'>) =>
  claim.organizationName?.trim() || claim.customerName?.trim() || null;

export const claimsTexts = {
  list: {
    title: 'Réclamations',
    lead: 'Les réclamations des clients sur une séance : prise en charge sous 24 h, échanges, puis décision motivée.',
    caption: 'Réclamations du Nettoyage',
    empty: 'Aucune réclamation ne correspond à ces filtres.',
    emptyAll: 'Aucune réclamation pour l’instant.',
    toDo: 'À traiter',
    toDoHint: 'Les nouvelles réclamations à prendre en charge, puis celles en cours à décider ou à valider.',
    countUnknown: '—',
    open: 'Nouvelles',
    inProgress: 'En cours',
    filters: 'Filtres',
    status: 'Statut',
    agent: 'Agent de la séance',
    sort: 'Tri',
    all: 'Tous',
    allFeminine: 'Toutes',
    clear: 'Effacer les filtres',
    customerFilter: 'Filtre sur un client précis actif.',
    organizationFilter: 'Filtre sur une organisation précise active.',
    total: (count: number) => (count > 1 ? `${count} réclamations` : `${count} réclamation`),
    columns: {
      claim: 'Réclamation',
      customer: 'Client',
      status: 'Statut',
      next: 'À faire',
      opened: 'Ouverte le',
    },
    noName: 'Nom indisponible',
    late: 'Plus de 24 h sans réponse',
  },
  detail: {
    title: 'Réclamation',
    back: 'Retour aux réclamations',
    heading: (category: string) => `Réclamation — ${category}`,
    opened: 'Ouverte le',
    summary: 'Résumé',
    customer: 'Client',
    category: 'Motif',
    text: 'Récit du client',
    photos: 'Photos du client',
    photo: (rank: number) => `Photo ${rank}`,
    session: 'Séance',
    openSession: 'Ouvrir la séance',
    program: 'Programme',
    openProgram: 'Ouvrir le programme',
    firstResponse: 'Première réponse',
    firstResponseNone: (hours: number) => `Pas encore (objectif : ${hours} h)`,
    closed: 'Close le',
    noName: 'Nom indisponible',
  },
} as const;

/** Seuil du contrat au-delà duquel un crédit attend la validation d'une deuxième personne (R-RC-03). */
export const CREDIT_APPROVAL_THRESHOLD = 50_000;
/** Bornes du contrat : message au client (2 000 caractères), montant saisi (100 000 000 FCFA). */
export const MAX_CLAIM_MESSAGE = 2000;
export const MAX_CREDIT = 100_000_000;

export const claimActionTexts = {
  title: 'Gestes',
  closed: 'Réclamation close : plus aucun geste possible.',
  take: {
    open: 'Prendre en charge',
    done: 'Réclamation prise en charge.',
  },
  messages: {
    title: 'Échanges avec le client',
    empty: 'Aucun échange pour l’instant.',
    customer: 'Client',
    staff: 'KSP',
    label: 'Réponse au client',
    hint: (max: number) => `${max} caractères au plus. Le client la voit dans son application.`,
    send: 'Envoyer la réponse',
    sending: 'Envoi…',
    done: 'Réponse envoyée au client.',
    required: 'Écrivez votre réponse.',
    tooLong: (max: number) => `${max} caractères au plus.`,
  },
  decide: {
    open: 'Décider',
    title: 'Décider de la réclamation',
    text: 'La décision est communiquée au client et ne se modifie plus. Une repasse gratuite ajoute une séance à 0 FCFA au programme ; un crédit va au wallet du particulier ou devient un avoir pour une entreprise.',
    outcome: 'Décision',
    choose: 'Choisir une décision',
    outcomeRequired: 'Choisissez une décision.',
    amount: 'Montant du crédit (FCFA)',
    amountHint: (threshold: string) =>
      `Au-delà de ${threshold}, une deuxième personne doit valider le crédit.`,
    amountRequired: 'Saisissez le montant du crédit.',
    amountInvalid: (max: string) => `Saisissez un montant entier en FCFA, de 0 à ${max}.`,
    reason: 'Motif de la décision',
    confirm: 'Confirmer la décision',
    done: 'Décision enregistrée.',
    donePending: 'Décision enregistrée : le crédit attend la validation d’une deuxième personne.',
  },
  approve: {
    open: 'Valider le crédit',
    title: 'Valider le crédit',
    text: 'Le crédit sera versé au client (wallet ou avoir) et la réclamation sera résolue.',
    confirm: 'Valider et verser',
    done: 'Crédit validé et versé.',
    mine: 'Vous avez pris cette décision : une autre personne doit valider le crédit.',
  },
  decision: {
    title: 'Décision',
    outcome: 'Issue',
    reason: 'Motif',
    decided: 'Décidée',
    decidedBy: (date: string, name: string) => `le ${date} par ${name}`,
    someone: 'une personne de KSP',
    credit: 'Crédit',
    approval: 'Validation',
    approvals: {
      not_required: 'Non requise',
      pending: 'En attente d’une deuxième personne',
      approved: 'Validé',
    } as Record<string, string>,
    redo: 'Repasse',
    openRedo: 'Ouvrir la séance de repasse',
  },
  readOnly: 'Lecture seule : votre compte ne traite pas les réclamations.',
  mfaHint:
    'La décision et la validation d’un crédit exigent une double authentification de moins de 10 minutes.',
} as const;
