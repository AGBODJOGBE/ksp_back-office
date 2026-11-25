import type { BadgeTone } from '@/components/ui/badge';
import type {
  AssignmentStatus,
  AutoFailureReason,
  BatchWarning,
  CheckKind,
  TargetKind,
} from './planning-schemas';
import { visitStatus } from './request-detail-texts';

/** Textes du planning et des affectations (`/nettoyage/planning`, sous-lot 1c-2). */

const plural = (count: number, one: string, many: string) => `${count} ${count > 1 ? many : one}`;
type Status = { label: string; tone: BadgeTone };

const SESSION_STATUSES: Record<string, Status> = {
  to_assign: { label: 'À affecter', tone: 'warning' },
  assigned: { label: 'Affectée', tone: 'brand' },
  in_progress: { label: 'En cours', tone: 'accent' },
  interrupted: { label: 'Interrompue', tone: 'warning' },
  completed: { label: 'Faite', tone: 'success' },
  missed: { label: 'Client absent', tone: 'warning' },
  suspended: { label: 'Suspendue', tone: 'neutral' },
  cancelled: { label: 'Annulée', tone: 'neutral' },
};

/** Statut d'une visite ou d'une séance (`status` libre dans `CleaningPlanningItem`). */
export const itemStatus = (kind: TargetKind, status: string): Status =>
  kind === 'visit' ? visitStatus(status) : (SESSION_STATUSES[status] ?? { label: status, tone: 'neutral' });

export const checkNames: Record<CheckKind, string> = {
  active: 'Agent actif',
  skills: 'Compétences',
  zone: 'Zone de travail',
  availability: 'Disponibilité',
  unavailability: 'Indisponibilité déclarée',
  conflict: 'Conflit d’horaire (trajet compris)',
  load: 'Charge de travail',
  team_size: 'Taille d’équipe',
};

export const assignmentStatuses: Record<AssignmentStatus, Status> = {
  proposed: { label: 'Proposée', tone: 'accent' },
  pending_confirmation: { label: 'En attente de l’agent', tone: 'warning' },
  confirmed: { label: 'Confirmée', tone: 'success' },
  declined: { label: 'Refusée', tone: 'danger' },
  expired: { label: 'Sans réponse', tone: 'neutral' },
  removed: { label: 'Retirée', tone: 'neutral' },
};

export const warningTexts: Record<BatchWarning, string> = {
  team_size_short: 'Moins d’agents que prévu : l’équipe reste incomplète.',
  team_lead_missing: 'Aucun chef d’équipe désigné.',
};

export const failureTexts: Record<AutoFailureReason, string> = {
  no_candidate: 'aucun agent disponible',
  team_incomplete: 'équipe incomplète',
  no_lead: 'aucun chef d’équipe possible',
};

export const planningTexts = {
  title: 'Planning',
  lead: 'Les visites et séances de la période, la colonne « à affecter » et la planification automatique.',
  grid: 'Planning de la période',
  filters: 'Filtres du planning',
  agent: 'Agent',
  team: 'Équipe',
  zone: 'Commune',
  all: 'Tous',
  allFeminine: 'Toutes',
  clear: 'Effacer les filtres',
  count: (count: number) => `${plural(count, 'intervention', 'interventions')} sur la période`,
  empty: 'Rien de planifié sur cette période pour ces filtres.',
  emptyAll: 'Rien de planifié sur cette période.',
  emptyDay: 'Rien de prévu.',
  holiday: (name: string) => `Férié : ${name}`,
  todayBadge: 'Aujourd’hui',
  dayCount: (count: number) => plural(count, 'intervention', 'interventions'),
  time: (start: string, end: string) => `${start} – ${end}`,
  kinds: { visit: 'Visite', session: 'Séance' } satisfies Record<TargetKind, string>,
  itemTitle: (kind: TargetKind, number: string, rank: number | null) =>
    kind === 'visit'
      ? `Visite du dossier ${number}`
      : `Séance${rank === null ? '' : ` n° ${rank}`} du programme ${number}`,
  staffing: (count: number, size: number) => `${count} / ${size} agent${size > 1 ? 's' : ''}`,
  missing: (count: number) => `${plural(count, 'agent manque', 'agents manquent')}`,
  noAgent: 'Aucun agent',
  leadBadge: 'Chef',
  urgent: 'Urgent (moins de 48 h)',
  late: 'En retard',
  suggested: (time: string) => `Rattrapage proposé : ${time}`,
  confirmation: { confirmed: 'confirmé', pending: 'en attente', proposed: 'proposé' },
  manage: 'Gérer',
  manageLabel: (title: string, time: string) => `Gérer : ${title}, ${time}`,
  openRequest: 'Trouver le dossier',
  noProgramLink:
    'Le planning ne donne pas l’identifiant du programme : ouvrez-le depuis la liste des programmes.',
  types: 'Types de nettoyage',
  skills: 'Compétences requises',
  noSkill: 'Aucune',
  where: 'Commune',
  close: 'Fermer',
  loads: {
    title: 'Charge des agents',
    lead: 'Heures prévues sur la période, comparées au maximum de chaque agent.',
    empty: 'Aucun agent planifié sur la période.',
    agent: 'Agent',
    planned: 'Prévu',
    max: 'Maximum',
    share: 'Part',
    over: 'Au-delà du maximum',
    none: '—',
  },
  unassigned: {
    title: 'À affecter',
    lead: 'Visites à planifier et séances sans équipe complète, les plus proches d’abord.',
    count: (count: number) => plural(count, 'élément', 'éléments'),
    empty: 'Rien à affecter : toutes les équipes sont complètes.',
    assign: 'Affecter',
    assignLabel: (title: string) => `Affecter : ${title}`,
  },
} as const;
