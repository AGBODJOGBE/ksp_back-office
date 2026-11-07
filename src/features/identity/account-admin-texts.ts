import type { BadgeTone } from '@/components/ui/badge';

/** Administration des comptes et des rôles (module « Administration », ADR-038) : adresses et textes. */

export const accountPaths = {
  list: '/administration/comptes',
  account: (id: string) => `/administration/comptes/${encodeURIComponent(id)}`,
} as const;

type StatusLabel = { label: string; tone: BadgeTone };

const statuses: Record<string, StatusLabel> = {
  active: { label: 'Actif', tone: 'success' },
  suspended: { label: 'Suspendu', tone: 'danger' },
  deletion_pending: { label: 'Suppression demandée', tone: 'warning' },
  pending_verification: { label: 'À vérifier', tone: 'neutral' },
  locked: { label: 'Bloqué', tone: 'danger' },
  deleted: { label: 'Supprimé', tone: 'neutral' },
};

export function accountStatus(status: string): StatusLabel {
  return statuses[status] ?? { label: status, tone: 'neutral' };
}

/** Rôles du catalogue en français simple ; un rôle inconnu garde sa description ou son code. */
const roles: Record<string, string> = {
  super_admin: 'Super administrateur',
  support_agent: 'Agent du support',
  finance_officer: 'Agent financier',
  cleaning_admin: 'Responsable du Nettoyage',
  cleaning_supervisor: 'Superviseur du Nettoyage',
  cleaning_agent: 'Agent du Nettoyage',
  recovery_admin: 'Responsable du Recouvrement',
  recovery_agent: 'Agent de recouvrement',
};
export const roleLabel = (code: string, description?: string) => roles[code] ?? description ?? code;

const services: Record<string, string> = {
  identity: 'Comptes',
  cleaning: 'Nettoyage',
  recovery: 'Recouvrement',
  wallet: 'Finance',
};
const serviceLabel = (code: string) => services[code] ?? code;

/** Périmètre d'une attribution : tout KSP, ou un métier. */
export function scopeLabel(scopeType: string, scopeId: string | null): string {
  if (scopeType === 'global') return 'Tout KSP';
  if (scopeType === 'domain' && scopeId) return `Métier : ${serviceLabel(scopeId)}`;
  return scopeId ? `${scopeType} : ${scopeId}` : scopeType;
}

const historyActions: Record<string, string> = {
  'user.role_granted': 'Rôle attribué',
  'user.role_revoked': 'Rôle retiré',
  'user.suspended': 'Compte suspendu',
  'user.reactivated': 'Compte réactivé',
  'user.mfa_reset': 'Double authentification réinitialisée',
};
export const historyAction = (action: string) => historyActions[action] ?? action;

export function personName(person: { firstName: string | null; lastName: string | null }): string | null {
  return [person.firstName, person.lastName].filter(Boolean).join(' ').trim() || null;
}

export const accountTexts = {
  module: 'Administration',
  common: {
    loading: 'Chargement…',
    retry: 'Réessayer',
    cancel: 'Annuler',
    sending: 'Envoi…',
    loadMore: 'Afficher plus',
    loadingMore: 'Chargement de la suite…',
    reasonLabel: 'Motif',
    reasonHint: 'Gardé dans l’historique du compte. 500 caractères au plus.',
    reasonRequired: 'Indiquez un motif.',
    unnamed: 'Nom non renseigné',
    noPhone: 'Aucun numéro',
  },
  nav: { label: 'Administration', accounts: 'Comptes et rôles' },
  list: {
    title: 'Comptes et rôles',
    lead: 'Retrouvez un compte KSP, donnez-lui un rôle du back-office ou retirez-le. Sans recherche, la liste montre les comptes qui ont déjà un rôle.',
    searchLabel: 'Nom ou numéro',
    searchHint: 'Au moins 2 lettres du nom, ou le numéro complet avec l’indicatif (+229…).',
    search: 'Rechercher',
    clear: 'Voir l’équipe',
    caption: 'Comptes',
    teamTitle: 'Comptes qui ont un rôle',
    resultsTitle: (query: string) => `Résultats pour « ${query} »`,
    empty: 'Aucun compte n’a encore de rôle dans votre périmètre.',
    emptySearch:
      'Aucun compte trouvé. Pour une personne hors de votre équipe, cherchez par son numéro complet.',
    columns: { name: 'Nom', phone: 'Téléphone', status: 'État', roles: 'Rôles', createdAt: 'Compte créé le' },
    noRole: 'Aucun rôle',
  },
  detail: {
    back: 'Retour aux comptes',
    notFound: 'Ce compte est introuvable.',
    created: (date: string) => `Compte créé le ${date}.`,
    suspended: (date: string | null, reason: string | null) =>
      `Compte suspendu${date ? ` depuis le ${date}` : ''}.${reason ? ` Motif : ${reason}.` : ''} La personne ne peut plus se connecter.`,
    identityTitle: 'Identité',
    name: 'Nom',
    phone: 'Téléphone',
    phoneMasked: 'Téléphone (masqué)',
    status: 'État',
    createdAt: 'Compte créé le',
    mfaTitle: 'Double authentification',
    mfaConfigured: (date: string | null) => `Configurée${date ? ` le ${date}` : ''}.`,
    mfaCodes: (count: number) =>
      count > 1
        ? `${count} codes de récupération restants.`
        : count === 1
          ? '1 code de récupération restant.'
          : 'Plus aucun code de récupération.',
    mfaMissing:
      'Pas encore configurée. Elle sera demandée à la prochaine connexion au back-office, avant tout accès.',
    rolesTitle: 'Rôles actifs',
    rolesCaption: 'Rôles actifs du compte',
    noRoles: 'Aucun rôle du back-office : ce compte ne peut pas s’y connecter.',
    pastTitle: 'Rôles retirés',
    pastCaption: 'Rôles retirés du compte',
    role: 'Rôle',
    scope: 'Périmètre',
    granted: 'Attribué',
    revoked: 'Retiré',
    by: (name: string | null, date: string) => (name ? `le ${date} par ${name}` : `le ${date}`),
    bootstrap: (date: string) => `le ${date}, à l’installation`,
    reason: 'Motif',
    noReason: '—',
    accountTitle: 'Accès au compte',
    noAccountAction:
      'Aucune action possible ici. La suspension est réservée au super administrateur, et personne ne suspend son propre compte.',
    historyTitle: 'Historique',
    historyCaption: 'Actions du back-office sur ce compte',
    noHistory: 'Aucune action enregistrée depuis le back-office.',
    when: 'Date',
    what: 'Action',
    who: 'Par',
    unknownActor: 'Compte sans nom',
  },
  actions: {
    grant: {
      label: 'Attribuer un rôle',
      title: 'Attribuer un rôle',
      text: 'Le rôle s’applique dans les 15 minutes, à la prochaine actualisation de la session de la personne.',
      mfaNotice:
        'Ce compte n’a pas encore de double authentification : elle lui sera demandée à sa prochaine connexion au back-office.',
      roleLabel: 'Rôle',
      choose: 'Choisir un rôle',
      roleRequired: 'Choisissez un rôle.',
      noRoleLeft: 'Ce compte a déjà tous les rôles que vous pouvez attribuer.',
      loadingRoles: 'Chargement des rôles…',
      confirm: 'Attribuer le rôle',
      done: (role: string) => `Rôle « ${role} » attribué.`,
    },
    revoke: {
      label: 'Retirer',
      accessible: (role: string) => `Retirer le rôle ${role}`,
      title: (role: string) => `Retirer le rôle « ${role} » ?`,
      text: 'La personne perd ce rôle dans les 15 minutes. Sans autre rôle, elle ne peut plus se connecter au back-office.',
      confirm: 'Retirer le rôle',
      done: (role: string) => `Rôle « ${role} » retiré.`,
    },
    suspend: {
      label: 'Suspendre le compte',
      title: 'Suspendre ce compte ?',
      text: 'Toutes les sessions de la personne sont fermées tout de suite : elle ne peut plus se connecter, ni sur les sites, ni au back-office.',
      confirm: 'Suspendre le compte',
      done: 'Compte suspendu.',
    },
    reactivate: {
      label: 'Réactiver le compte',
      title: 'Réactiver ce compte ?',
      text: 'La personne pourra de nouveau se connecter, avec les rôles qu’elle a encore.',
      confirm: 'Réactiver le compte',
      done: 'Compte réactivé.',
    },
    resetMfa: {
      label: 'Réinitialiser',
      title: 'Réinitialiser la double authentification ?',
      text: 'À faire si la personne a perdu son téléphone, après avoir vérifié son identité. Son application et ses codes de récupération ne marchent plus ; à sa prochaine connexion, elle configurera une nouvelle application.',
      confirm: 'Réinitialiser',
      done: 'Double authentification réinitialisée.',
    },
  },
  errors: {
    stale: 'Ce compte a changé entre-temps : la fiche a été actualisée.',
  },
} as const;
