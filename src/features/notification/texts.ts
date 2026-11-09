import type { BadgeTone } from '@/components/ui/badge';

/** Textes du module Notifications du back-office (ADR-039). */

export const notificationPaths = {
  deliveries: '/notifications/envois',
  delivery: (id: string) => `/notifications/envois/${encodeURIComponent(id)}`,
  /** Envois d'un compte (identifiant), depuis une autre fiche. */
  forRecipient: (userId: string) => `/notifications/envois?destinataire=${encodeURIComponent(userId)}`,
  templates: '/notifications/modeles',
} as const;

type StatusLabel = { label: string; tone: BadgeTone };

const statuses: Record<string, StatusLabel> = {
  pending: { label: 'En cours', tone: 'warning' },
  accepted: { label: 'Pris en charge', tone: 'success' },
  failed: { label: 'Échec', tone: 'danger' },
};
export const deliveryStatus = (code: string): StatusLabel =>
  statuses[code] ?? { label: code, tone: 'neutral' };

const channels: Record<string, string> = {
  whatsapp: 'WhatsApp',
  email: 'E-mail',
  sms: 'SMS',
  push: 'Notification push',
  in_app: 'Espace KSP',
};
export const channelName = (code: string) => channels[code] ?? code;

const failures: Record<string, string> = {
  recipient_invalid: 'destinataire refusé par le prestataire (numéro sans WhatsApp, adresse invalide)',
  provider_unavailable: 'prestataire indisponible (panne, délai, limite d’envoi)',
  provider_rejected: 'refusé par le prestataire (modèle non approuvé, jeton expiré…)',
  ttl_expired: 'délai de validité dépassé avant l’envoi',
};
export const failureReason = (code: string) => failures[code] ?? code;

const kinds: Record<string, { label: string; hint: string }> = {
  direct: {
    label: 'Envoi direct',
    hint: 'Demandé par un service (codes) ; WhatsApp ou e-mail selon le modèle.',
  },
  short: { label: 'Message court', hint: 'WhatsApp, puis e-mail en bascule.' },
  document: { label: 'Document', hint: 'E-mail si l’adresse est vérifiée, sinon WhatsApp.' },
  important: { label: 'Important', hint: 'WhatsApp et e-mail, toujours.' },
};
export const templateKind = (code: string) => kinds[code] ?? { label: code, hint: '' };

export const notificationTexts = {
  title: 'Notifications',
  loading: 'Chargement…',
  retry: 'Réessayer',
  loadMore: 'Afficher plus',
  loadingMore: 'Chargement…',
  all: 'Tous',
  deliveries: {
    title: 'Historique des envois',
    lead: 'Chaque message envoyé par KSP, le plus récent d’abord. Le texte d’un message n’est jamais conservé ; le destinataire est masqué.',
    caption: 'Envois de messages',
    empty: 'Aucun envoi pour le moment.',
    emptyFiltered: 'Aucun envoi ne correspond à ces filtres.',
    filters: 'Filtres actifs',
    template: 'Modèle',
    channel: 'Canal essayé',
    status: 'Statut',
    from: 'Du',
    to: 'Au',
    recipient: 'Compte destinataire',
    recipientHint: 'Identifiant du compte (jamais un numéro ni une adresse).',
    recipientInvalid: 'Identifiant de compte attendu (UUID).',
    apply: 'Rechercher',
    reset: 'Effacer les filtres',
    removeFilter: (label: string) => `Retirer le filtre ${label}`,
    byRecipient: 'Un compte',
    columns: {
      template: 'Modèle',
      status: 'Statut',
      channels: 'Canaux',
      target: 'Destinataire',
      created: 'Envoyé le',
    },
    erased: 'Compte supprimé',
    noTarget: '—',
    tried: (list: string) => `Essayés : ${list}`,
  },
  delivery: {
    back: 'Retour à l’historique',
    title: (template: string) => `Envoi « ${template} »`,
    notFound: 'Cet envoi est introuvable.',
    summary: 'Résumé',
    attempts: 'Canaux essayés',
    attemptsHint: 'Dans l’ordre ; un canal sans prestataire configuré est sauté.',
    used: 'utilisé',
    failure: 'Cause de l’échec',
    errorCode: 'Code d’erreur',
    requestedChannel: 'Canal demandé',
    channelUsed: 'Canal utilisé',
    target: 'Destinataire (masqué)',
    recipient: 'Compte destinataire',
    provider: 'Identifiant chez le prestataire',
    created: 'Créé le',
    accepted: 'Pris en charge le',
    failed: 'Échec le',
    expires: 'Valable jusqu’au',
    erased:
      'Compte supprimé : l’envoi a été détaché du compte (ADR-036). Restent le modèle, les canaux et le statut.',
    otherDeliveries: 'Autres envois de ce compte',
    noText: 'Le texte et les variables d’un envoi ne sont jamais conservés (codes de connexion compris).',
  },
  templates: {
    title: 'Modèles de messages',
    lead: 'Textes envoyés par KSP, en lecture seule. Les variables sont entre accolades ; un texte qui dépend d’une valeur (motif, nombre) n’en montre qu’une variante.',
    search: 'Rechercher un modèle',
    count: (count: number) => (count === 1 ? '1 modèle' : `${count} modèles`),
    none: 'Aucun modèle ne correspond.',
    channels: 'Canaux',
    variables: 'Variables',
    optionalVariables: 'Variables facultatives',
    secret: 'Secret',
    secretHint: 'Ni le texte ni les variables ne sont conservés.',
    optional: 'Soumis aux préférences du client',
    mandatory: 'Toujours envoyé',
    subject: 'Objet',
    providerText: 'Texte rédigé chez le prestataire (modèle WhatsApp approuvé par Meta).',
    seeDeliveries: 'Voir les envois',
  },
} as const;
