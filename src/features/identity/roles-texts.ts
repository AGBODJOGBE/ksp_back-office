/** Rôles dynamiques du back-office (ADR-057) : adresses, libellés et textes. */

export const rolePaths = {
  list: '/administration/roles',
  // Un code de rôle n'a jamais de tiret (`^[a-z][a-z0-9_]{2,63}$`) : l'adresse ne peut pas masquer un rôle.
  create: '/administration/roles/nouveau-role',
  role: (code: string) => `/administration/roles/${encodeURIComponent(code)}`,
} as const;

/** Groupes de cases (deuxième segment du code de permission) ; un groupe inconnu garde son code. */
const modules: Record<string, string> = {
  catalog: 'Catalogue et tarifs',
  zone: 'Zones desservies',
  request: 'Dossiers et visites',
  quote: 'Devis',
  planning: 'Planning et affectations',
  agent: 'Agents',
  program: 'Programmes et séances',
  claim: 'Réclamations',
  settings: 'Réglages',
  visit: 'Visites (application de l’agent)',
  session: 'Séances (application de l’agent)',
};
export const moduleLabel = (code: string) => modules[code] ?? code;

export const roleTexts = {
  nav: { label: 'Sections de l’administration', accounts: 'Comptes', roles: 'Rôles' },
  list: {
    title: 'Rôles',
    lead: 'Chaque rôle réunit des permissions déclarées par les services. Les droits d’une personne sont l’union des permissions de ses rôles ; un changement s’applique dans les 15 minutes.',
    create: 'Créer un rôle',
    caption: 'Rôles du back-office',
    empty: 'Aucun rôle enregistré.',
    columns: { name: 'Rôle', origin: 'Origine', service: 'Service', state: 'État' },
    open: (name: string) => `Ouvrir le rôle ${name}`,
  },
  origin: { default: 'Livré par défaut', custom: 'Créé au back-office' } as Record<string, string>,
  state: { active: 'Actif', inactive: 'Désactivé' },
  sensitive: 'Sensible',
  detail: {
    back: 'Retour aux rôles',
    notFound: 'Ce rôle est introuvable.',
    infoTitle: 'Rôle',
    code: 'Code',
    origin: 'Origine',
    service: 'Service',
    scope: 'Portée',
    access: 'Accès',
    accessValue: (backoffice: boolean, mfa: boolean) =>
      [backoffice ? 'Back-office' : 'Hors back-office', mfa ? 'double authentification exigée' : null]
        .filter(Boolean)
        .join(', '),
    sensitiveTerm: 'Sensibilité',
    sensitiveValue: (sensitive: boolean) =>
      sensitive ? 'Sensible : son retrait ferme tout de suite les sessions' : 'Ordinaire',
    assignments: 'Attributions actives',
    assignmentsValue: (count: number) =>
      count > 1 ? `${count} comptes` : count === 1 ? '1 compte' : 'Aucun compte',
    created: 'Créé',
    updated: 'Modifié',
    deactivated: 'Désactivé',
    at: (date: string) => `le ${date}`,
    permissionsTitle: 'Permissions',
    permissionsCount: (count: number) =>
      count > 1
        ? `${count} permissions cochées.`
        : count === 1
          ? '1 permission cochée.'
          : 'Aucune permission.',
    retired: 'Retirée',
    retiredNotice: (count: number) =>
      count > 1
        ? `${count} permissions ne sont plus déclarées par leur service : elles n’entrent plus dans les jetons. Décochez-les à la prochaine modification.`
        : 'Une permission n’est plus déclarée par son service : elle n’entre plus dans les jetons. Décochez-la à la prochaine modification.',
    notEditable:
      'Ce rôle n’est pas modifiable : le super administrateur garde toujours toutes les permissions.',
    inactive: 'Ce rôle est désactivé : il n’est plus attribuable et ne se modifie plus.',
    edit: 'Modifier',
    loadingCatalog: 'Chargement des permissions…',
  },
  form: {
    code: 'Code',
    codeHint: 'Définitif. Minuscules, chiffres et _ ; commence par une lettre ; 3 à 64 caractères.',
    codeInvalid:
      'Le code doit commencer par une lettre et ne contenir que des minuscules, chiffres et _ (3 à 64).',
    name: 'Nom',
    nameRequired: 'Indiquez un nom.',
    description: 'Description',
    descriptionHint: '500 caractères au plus.',
    sensitive: 'Rôle sensible',
    sensitiveHint: 'Son retrait fermera tout de suite les sessions de la personne, sans attendre 15 minutes.',
    permissions: 'Permissions',
    permissionsHint: 'Cochez ce que le rôle permet. Une case = un contrôle réel du service.',
    selected: (count: number) => (count > 1 ? `${count} cochées` : `${count} cochée`),
    noPermission: 'Aucune permission déclarée par les services.',
    save: 'Enregistrer',
    cancel: 'Annuler',
    create: 'Créer le rôle',
    noChange: 'Aucun changement à enregistrer.',
  },
  update: {
    title: (name: string) => `Modifier le rôle « ${name} » ?`,
    text: 'Le changement s’applique à chaque titulaire dans les 15 minutes, au renouvellement de sa session.',
    added: (count: number) => (count > 1 ? `${count} permissions ajoutées` : '1 permission ajoutée'),
    removed: (count: number) => (count > 1 ? `${count} permissions retirées` : '1 permission retirée'),
    fields: 'Autres changements',
    fieldName: 'nom',
    fieldDescription: 'description',
    fieldSensitive: 'sensibilité',
    confirm: 'Enregistrer les changements',
    done: 'Rôle modifié.',
  },
  createDialog: {
    heading: 'Créer un rôle',
    lead: 'Le rôle est créé actif, de portée globale, avec accès au back-office et double authentification exigée pour ses titulaires. Il s’attribue ensuite depuis la fiche d’un compte.',
    title: (name: string) => `Créer le rôle « ${name} » ?`,
    text: (count: number) =>
      count > 1
        ? `${count} permissions cochées.`
        : count === 1
          ? '1 permission cochée.'
          : 'Aucune permission cochée.',
    confirm: 'Créer le rôle',
  },
  deactivate: {
    label: 'Désactiver',
    title: (name: string) => `Désactiver le rôle « ${name} » ?`,
    text: 'Un rôle ne se supprime jamais. Désactivé, il n’est plus attribuable ; cette action est définitive depuis le back-office.',
    inUse: (count: number) =>
      `${count > 1 ? `${count} comptes ont` : 'Un compte a'} encore ce rôle : réaffectez-les puis retirez-le-leur avant de le désactiver.`,
    confirm: 'Désactiver le rôle',
    done: 'Rôle désactivé.',
  },
  errors: {
    stale: 'Ce rôle a changé entre-temps : la fiche a été actualisée.',
    exists: 'Un rôle porte déjà ce code. Choisissez-en un autre.',
    notEditable: 'Ce rôle n’est pas modifiable.',
    inactive: 'Ce rôle est désactivé : il ne se modifie plus.',
    unknownPermission: 'Une permission cochée n’existe plus. La liste a été actualisée : vérifiez vos cases.',
  },
} as const;
