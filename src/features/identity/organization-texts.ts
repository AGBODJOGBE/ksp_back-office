import type { BadgeTone } from '@/components/ui/badge';

/** Comptes entreprise du back-office (module « Clients et comptes ») : adresses, droits, textes. */

export const organizationPaths = {
  list: '/clients/entreprises',
  organization: (id: string) => `/clients/entreprises/${encodeURIComponent(id)}`,
} as const;

/**
 * Rôles du contrat (`x-ksp-roles`) : consultation `super_admin` et `support_agent`, décisions
 * `super_admin`. Affichage seulement : identity revérifie chaque appel.
 */
export function organizationAccess(roles: readonly string[]) {
  const decide = roles.includes('super_admin');
  return { read: decide || roles.includes('support_agent'), decide };
}

type StatusLabel = { label: string; tone: BadgeTone };

export const organizationStatuses: Record<string, StatusLabel> = {
  pending_review: { label: 'En attente de validation', tone: 'accent' },
  active: { label: 'Validée', tone: 'success' },
  suspended: { label: 'Suspendue', tone: 'danger' },
  rejected: { label: 'Refusée', tone: 'neutral' },
};

export function organizationStatus(status: string): StatusLabel {
  return organizationStatuses[status] ?? { label: status, tone: 'neutral' };
}

const roles: Record<string, string> = {
  org_admin: 'Administrateur',
  org_member: 'Membre',
  org_viewer: 'Lecteur',
};
export const memberRole = (code: string) => roles[code] ?? code;

export const organizationTexts = {
  module: 'Clients et comptes',
  common: {
    loading: 'Chargement…',
    retry: 'Réessayer',
    cancel: 'Annuler',
    sending: 'Envoi…',
    loadMore: 'Afficher plus',
    loadingMore: 'Chargement de la suite…',
    all: 'Toutes',
    reasonLabel: 'Motif communiqué au client',
    reasonHint: '500 caractères au plus.',
    reasonRequired: 'Indiquez un motif.',
  },
  list: {
    title: 'Comptes entreprise',
    lead: 'Demandes de création à valider ou refuser, et comptes validés ou suspendus.',
    caption: 'Comptes entreprise',
    status: 'État',
    empty: 'Aucun compte entreprise pour le moment.',
    emptyFiltered: 'Aucun compte entreprise dans cet état.',
    columns: {
      legalName: 'Raison sociale',
      status: 'État',
      ifu: 'IFU',
      createdAt: 'Demandé le',
      reviewedAt: 'Décision le',
    },
    noDecision: 'En attente',
  },
  detail: {
    back: 'Retour aux comptes entreprise',
    notFound: 'Ce compte entreprise est introuvable.',
    requested: (date: string) => `Demande reçue le ${date}.`,
    rejected: (reason: string) => `Demande refusée. Motif communiqué au client : ${reason}`,
    suspended: (date: string | null, reason: string | null) =>
      `Compte suspendu${date ? ` depuis le ${date}` : ''}${reason ? `. Motif : ${reason}` : '.'}`,
    pending:
      'Demande à traiter : vérifiez l’IFU et le RCCM, puis validez ou refusez. Le demandeur est prévenu de la décision.',
    identityTitle: 'Identité légale',
    legalName: 'Raison sociale',
    address: 'Adresse',
    ifu: 'IFU',
    rccm: 'RCCM',
    noRccm: 'Non renseigné',
    billingEmail: 'E-mail de facturation',
    noBillingEmail: 'Aucun e-mail confirmé',
    createdAt: 'Demandée le',
    reviewedAt: 'Décision le',
    suspendedAt: 'Suspendue le',
    membersTitle: 'Membres',
    membersCaption: 'Membres du compte entreprise',
    noMembers: 'Aucun membre.',
    member: 'Membre',
    role: 'Rôle',
    phone: 'Téléphone',
    joinedAt: 'Depuis le',
    requester: 'demandeur',
    unnamed: 'Nom non renseigné',
    noPhone: 'Non renseigné',
    call: (name: string) => `Appeler ${name}`,
    invoices: 'Factures de l’entreprise',
    decisionsTitle: 'Décision',
    decisionsReserved:
      'Les décisions (validation, refus, suspension) sont réservées au super administrateur.',
    noDecision: 'Aucune décision possible dans cet état.',
  },
  actions: {
    validate: {
      label: 'Valider',
      title: 'Valider ce compte entreprise ?',
      text: 'Le compte pourra devenir le contexte actif de ses membres. Le demandeur est prévenu.',
      confirm: 'Valider le compte',
      done: 'Compte entreprise validé.',
    },
    reject: {
      label: 'Refuser',
      title: 'Refuser cette demande ?',
      text: 'Refus définitif ; le client pourra faire une nouvelle demande. Le motif lui est communiqué.',
      confirm: 'Refuser la demande',
      done: 'Demande refusée.',
    },
    suspend: {
      label: 'Suspendre',
      title: 'Suspendre ce compte entreprise ?',
      text: 'Le compte ne pourra plus devenir le contexte actif : les sessions qui l’utilisent reviennent au compte personnel sous 15 minutes. Les contrats du Nettoyage sont suspendus.',
      confirm: 'Suspendre le compte',
      done: 'Compte entreprise suspendu.',
    },
    reactivate: {
      label: 'Lever la suspension',
      title: 'Lever la suspension ?',
      text: 'Le compte redevient validé : ses membres peuvent de nouveau l’utiliser.',
      confirm: 'Lever la suspension',
      done: 'Suspension levée.',
    },
  },
  errors: {
    invalidTransition: 'Ce compte a changé d’état entre-temps : la fiche a été actualisée.',
  },
} as const;
