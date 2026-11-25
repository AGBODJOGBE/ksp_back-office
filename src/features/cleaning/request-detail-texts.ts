import type { BadgeTone } from '@/components/ui/badge';
import type { NextActionKey, StepKey, StepState } from './request-steps';
import type { VisitFee, VisitStatus } from './requests-schemas';

/** Textes de la fiche dossier (sous-lot 1b) : frise, demande, visites. */

const names =
  <K extends string>(entries: Record<K, string>) =>
  (code: K | string): string =>
    (entries as Record<string, string>)[code] ?? code;

export const requestDetailTexts = {
  back: 'Retour aux dossiers',
  title: (number: string) => `Dossier ${number}`,
  created: (date: string) => `Reçu le ${date}`,
  readOnly: 'Lecture seule : votre rôle ne permet pas de traiter ce dossier.',
  warnings: { organization_unpaid_invoices: 'L’organisation a des factures impayées.' } as Record<
    string,
    string
  >,
  steps: {
    label: 'Étapes du dossier',
    names: {
      request: 'Demande',
      visit: 'Visite',
      retained: 'Version retenue',
      quote: 'Devis',
      follow: 'Suite',
    } satisfies Record<StepKey, string>,
    states: {
      done: 'terminée',
      current: 'en cours',
      todo: 'à venir',
      stopped: 'dossier arrêté ici',
    } satisfies Record<StepState, string>,
  },
  next: {
    title: 'Action suivante',
    go: 'Aller à l’étape',
    labels: {
      decideReactivation: 'Le client demande la réactivation de son devis expiré : décidez.',
      waitFee: 'En attente du paiement des frais de visite par le client.',
      scheduleVisit: 'Planifier la visite du lieu.',
      waitVisit: 'Visite planifiée : en attente du passage de l’agent.',
      retain: 'Ajuster le constat de l’agent (version retenue).',
      composeQuote: 'Vérifier la version retenue puis composer le devis.',
      approveAdjustment: 'La remise du brouillon attend la validation d’un administrateur.',
      sendQuote: 'Relire le brouillon de devis puis l’envoyer au client.',
      waitCustomer: 'Devis envoyé : en attente de la réponse du client.',
      openProgram: 'Devis accepté : suivre le programme de séances.',
      accepted: 'Devis accepté : le programme est en préparation.',
      closed: 'Dossier clos : aucune action attendue.',
    } satisfies Record<NextActionKey, string>,
  },
  request: {
    title: 'Demande',
    customer: 'Client',
    customerKind: 'Clientèle',
    organization: 'Organisation',
    noName: 'Nom indisponible',
    place: 'Lieu',
    placeType: 'Type de lieu',
    commune: 'Commune',
    address: 'Adresse',
    readableAddress: 'Adresse calculée',
    landmark: 'Repère',
    coordinates: 'Coordonnées',
    coordinatesValue: (lat: number, lng: number, accuracy: number | null) =>
      `${lat}, ${lng}${accuracy === null ? '' : ` (à ${accuracy} m près)`}`,
    locationHidden: 'Position non communiquée à votre rôle.',
    types: 'Types demandés',
    answers: 'Réponses du client',
    noAnswer: 'Aucune réponse enregistrée.',
    freeDescription: 'Description libre',
    comment: 'Commentaire du client',
    photos: 'Photos du client',
    photo: (rank: number) => `Photo ${rank}`,
    photoExpired: 'photo non conservée',
    slots: 'Créneaux proposés pour la visite',
    declaredPrice: 'Estimation à la demande',
    fee: 'Frais de visite',
    feeHistory: 'Frais précédents',
    feeRank: (rank: number) => `Frais n° ${rank}`,
    payBefore: (date: string) => `à payer avant le ${date}`,
    paidAt: (date: string) => `payés le ${date}`,
    refundedAt: (date: string) => `remboursés le ${date}`,
  },
  reject: {
    open: 'Refuser le dossier',
    title: 'Refuser ce dossier ?',
    text: 'Le client est prévenu. Sans visite faite, ses frais de visite lui sont remboursés.',
    confirm: 'Refuser le dossier',
    reasonCode: 'Raison',
    reason: 'Motif communiqué',
    reasons: {
      place_inaccessible: 'Lieu inaccessible',
      service_impossible: 'Prestation impossible',
      other: 'Autre raison',
    },
  },
  location: {
    open: 'Corriger la position',
    title: 'Corriger la position du lieu ?',
    text: 'La commune est recalculée. La correction s’applique à la visite et aux séances à venir.',
    confirm: 'Corriger la position',
    latitude: 'Latitude',
    longitude: 'Longitude',
    accuracy: 'Précision (mètres) — facultatif',
    landmark: 'Repère — laisser vide pour le garder',
    address: 'Adresse — laisser vide pour la garder',
    reason: 'Motif de la correction',
    invalid: 'Latitude entre −90 et 90, longitude entre −180 et 180 (point décimal ou virgule).',
    done: (commune: string, changed: boolean) =>
      changed ? `Position corrigée : le lieu passe dans la commune ${commune}.` : 'Position corrigée.',
  },
  reactivation: {
    title: 'Réactivation demandée',
    requested: (date: string) => `Demandée le ${date}.`,
    statuses: { pending: 'En attente', accepted: 'Acceptée', refused: 'Refusée' } as Record<string, string>,
    accept: 'Accepter la réactivation',
    acceptTitle: 'Accepter la réactivation ?',
    acceptText: 'Le dossier repasse « visite faite » et un nouveau devis est émis aux tarifs du jour.',
    refuse: 'Refuser la réactivation',
    refuseTitle: 'Refuser la réactivation ?',
    refuseText: 'Le dossier reste clos. Le client est prévenu.',
    reason: 'Motif — facultatif',
  },
  reason: 'Motif',
  reasonHint: '500 caractères au plus.',
} as const;

export const feeStatus = (status: VisitFee['status']): { label: string; tone: BadgeTone } =>
  (
    ({
      awaiting_payment: { label: 'À payer', tone: 'warning' },
      paid: { label: 'Payés', tone: 'success' },
      refunded: { label: 'Remboursés', tone: 'neutral' },
      retained: { label: 'Conservés', tone: 'neutral' },
      deducted: { label: 'Déduits du devis', tone: 'brand' },
    }) as Record<string, { label: string; tone: BadgeTone }>
  )[status] ?? { label: status, tone: 'neutral' };

export const visitStatus = (status: VisitStatus | string): { label: string; tone: BadgeTone } =>
  (
    ({
      scheduled: { label: 'Planifiée', tone: 'brand' },
      in_progress: { label: 'En cours', tone: 'accent' },
      completed: { label: 'Faite', tone: 'success' },
      missed: { label: 'Client absent', tone: 'warning' },
      cancelled: { label: 'Annulée', tone: 'neutral' },
    }) as Record<string, { label: string; tone: BadgeTone }>
  )[status] ?? { label: status, tone: 'neutral' };

export const cancelCause = names({
  request_cancelled: 'dossier annulé par le client',
  request_rejected: 'dossier refusé',
  slot_changed: 'créneau changé',
  ksp: 'annulée par KSP',
  agent_no_show: 'agent absent',
});

export const agentConfirmation = names({
  confirmed: 'confirmé',
  pending: 'à confirmer',
  proposed: 'proposé',
});
