import type { BadgeTone } from '@/components/ui/badge';
import type { AgentSort, AgentStatus, EmploymentKind, UnavailabilityKind } from './agents-schemas';
import type { Weekday } from './requests-schemas';

/** Textes des agents et candidatures du Nettoyage v2, sous-lot 1c. */

export const agentsTexts = {
  title: 'Agents et équipes',
  lead: 'Les agents de terrain, leurs candidatures, leurs disponibilités et leurs équipes.',
  sections: { label: 'Agents ou équipes', agents: 'Agents', teams: 'Équipes' },
  list: {
    caption: 'Agents du Nettoyage',
    empty: 'Aucun agent ne correspond à ces filtres.',
    emptyAll: 'Aucun agent pour l’instant. Invitez un agent par SMS pour commencer.',
    toDo: 'Candidatures à traiter',
    toDoHint: 'Candidatures déposées ou en vérification : vérifiez la pièce d’identité et les compétences.',
    countUnknown: '—',
    filters: 'Filtres',
    search: 'Nom ou téléphone',
    searchHint: '100 caractères au plus.',
    searchButton: 'Rechercher',
    tooLong: '100 caractères au plus.',
    status: 'Statut',
    commune: 'Commune de travail',
    skill: 'Compétence validée',
    sort: 'Tri',
    all: 'Tous',
    allFeminine: 'Toutes',
    clear: 'Effacer les filtres',
    count: (total: number) => (total > 1 ? `${total} agents` : `${total} agent`),
    columns: {
      name: 'Agent',
      status: 'Statut',
      zones: 'Communes de travail',
      skills: 'Compétences',
      employment: 'Statut d’emploi',
      rating: 'Note',
      created: 'Inscrit le',
    },
    noZone: 'Aucune',
    noSkill: 'Aucune',
    noRating: 'Pas encore notée',
    pending: 'à valider',
    newAgent: 'Inviter ou créer un agent',
  },
  detail: {
    title: 'Fiche agent',
    back: 'Retour aux agents',
    since: (date: string) => `Inscrit le ${date}`,
    updated: (date: string) => `Mis à jour le ${date}`,
    identity: 'Identité et contact',
    phone: 'Téléphone',
    employment: 'Statut d’emploi',
    residence: 'Commune de résidence',
    zones: 'Communes de travail',
    emergency: 'Personne à prévenir',
    mobileMoney: 'Numéro Mobile Money',
    noMobileMoney: 'Non renseigné',
    noZone: 'Aucune commune de travail.',
    skills: 'Compétences',
    skillsHint:
      'Une compétence déclarée mais non validée ne compte pas pour les affectations (R-AG-01). Cochez celles que vous avez vérifiées.',
    skillValidated: 'Validée',
    skillDeclared: 'Déclarée, à vérifier',
    noSkill: 'Aucune compétence.',
    stats: 'Activité',
    sessions: 'Séances faites',
    visits: 'Visites faites',
    hoursWeek: 'Heures cette semaine',
    hoursMonth: 'Heures ce mois-ci',
    rating: 'Note moyenne',
    ratings: (count: number) => `${count} avis`,
    claims: 'Réclamations ouvertes',
    noRating: 'Pas encore de note',
    load: 'Charge maximale',
    perDay: 'Heures par jour',
    perWeek: 'Heures par semaine',
    edit: 'Modifier la fiche',
    editTitle: 'Communes, compétences et charge',
    editSaved: 'Fiche enregistrée.',
    editHint:
      'Retirer une commune ou une compétence ne désaffecte rien : les affectations à venir sont signalées au superviseur.',
    emergencyName: 'Nom de la personne à prévenir',
    emergencyPhone: 'Téléphone de la personne à prévenir',
    readOnly: 'Lecture seule : la gestion des agents est réservée à l’administration du Nettoyage.',
  },
  idDocument: {
    title: 'Pièce d’identité',
    hint: 'Donnée sensible : affichée seulement à votre demande, par des liens temporaires. Chaque consultation est tracée.',
    show: 'Afficher la pièce d’identité',
    hide: 'Masquer la pièce d’identité',
    front: 'Recto',
    back: 'Verso',
    missing: 'Aucune pièce d’identité déposée.',
    expired: 'Lien expiré ou image indisponible : masquez puis affichez de nouveau.',
    open: 'Ouvrir dans un nouvel onglet',
    alt: (side: string, name: string) => `Pièce d’identité de ${name}, ${side.toLowerCase()}`,
  },
} as const;

const STATUS: Record<AgentStatus, { label: string; tone: BadgeTone }> = {
  applicant: { label: 'Candidature déposée', tone: 'warning' },
  under_review: { label: 'En vérification', tone: 'warning' },
  active: { label: 'Actif', tone: 'action' },
  suspended: { label: 'Suspendu', tone: 'danger' },
  deactivated: { label: 'Désactivé', tone: 'neutral' },
  rejected: { label: 'Refusé', tone: 'neutral' },
};

/** Statut d'un agent ; un statut inconnu reste lisible. */
export const agentStatus = (status: AgentStatus | string) =>
  STATUS[status as AgentStatus] ?? { label: status, tone: 'neutral' as BadgeTone };

/** Statuts des candidatures à traiter, mis en avant en tête de la liste. */
export const APPLICATION_STATUSES = ['applicant', 'under_review'] as const satisfies readonly AgentStatus[];

const EMPLOYMENT: Record<EmploymentKind, string> = {
  employee: 'Salarié',
  independent: 'Indépendant partenaire',
};
export const employmentName = (kind: EmploymentKind | string) => EMPLOYMENT[kind as EmploymentKind] ?? kind;

const SORT: Record<AgentSort, string> = {
  lastName: 'Nom',
  '-createdAt': 'Inscription la plus récente',
  '-ratingAverage': 'Meilleure note',
};
export const agentSortName = (sort: AgentSort) => SORT[sort];

const WEEKDAY: Record<Weekday, string> = {
  mon: 'Lundi',
  tue: 'Mardi',
  wed: 'Mercredi',
  thu: 'Jeudi',
  fri: 'Vendredi',
  sat: 'Samedi',
  sun: 'Dimanche',
};
export const weekdayName = (day: Weekday) => WEEKDAY[day];

const UNAVAILABILITY: Record<UnavailabilityKind, string> = {
  leave: 'Congé',
  sickness: 'Maladie',
  other: 'Autre motif',
};
export const unavailabilityKindName = (kind: UnavailabilityKind | string) =>
  UNAVAILABILITY[kind as UnavailabilityKind] ?? kind;

/** « Koffi AGBO » : prénom puis nom. */
export const agentName = (agent: { firstName: string; lastName: string }) =>
  `${agent.firstName} ${agent.lastName}`.trim();

/** « 4,5 / 5 » : note moyenne à une décimale. */
export const formatRating = (value: number) =>
  `${value.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} / 5`;

/** « 12,5 h » : heures travaillées. */
export const formatHours = (value: number) =>
  `${value.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} h`;
