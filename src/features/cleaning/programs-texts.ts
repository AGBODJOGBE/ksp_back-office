import type { BadgeTone } from '@/components/ui/badge';
import type {
  IncidentCategory,
  PaymentStatus,
  Program,
  ProgramSort,
  ProgramStatus,
  SessionCancelCause,
  SessionStatus,
  SuspensionCause,
} from './programs-schemas';

/** Textes des programmes et des séances du Nettoyage v2, sous-lot 1c-3 : liste et statuts. */

type Status = { label: string; tone: BadgeTone };

export const programsTexts = {
  list: {
    title: 'Programmes',
    lead: 'Les programmes de séances nés des devis acceptés : leur avancement, leurs suspensions et leurs arrêts.',
    caption: 'Programmes du Nettoyage',
    empty: 'Aucun programme ne correspond à ces filtres.',
    emptyAll: 'Aucun programme pour l’instant.',
    toDo: 'À surveiller',
    suspended: 'Programmes suspendus',
    toDoHint:
      'Les programmes suspendus, et dans la liste ceux dont l’arrêt attend une validation ou qui ont des impayés.',
    countUnknown: '—',
    filters: 'Filtres',
    number: 'Numéro de programme',
    numberHint: 'Par exemple PN-000057.',
    search: 'Rechercher',
    status: 'Statut',
    payerKind: 'Payeur',
    commune: 'Commune',
    sort: 'Tri',
    all: 'Tous',
    allFeminine: 'Toutes',
    clear: 'Effacer les filtres',
    customerFilter: 'Filtre sur un client précis actif.',
    organizationFilter: 'Filtre sur une organisation précise active.',
    tooLong: '50 caractères au plus.',
    total: (count: number) => (count > 1 ? `${count} programmes` : `${count} programme`),
    columns: {
      number: 'Programme',
      customer: 'Client',
      place: 'Lieu',
      types: 'Offres',
      progress: 'Séances',
      status: 'Statut',
      next: 'À faire',
      created: 'Créé le',
    },
    progress: (done: number, count: number) => `${done} / ${count} réalisées`,
    noName: 'Nom indisponible',
    nothing: 'Rien à faire',
    closed: 'Programme terminé',
  },
  detail: {
    title: 'Programme de séances',
  },
  session: {
    title: 'Séance',
  },
} as const;

const PROGRAM_STATUS: Record<ProgramStatus, Status> = {
  confirmed: { label: 'Confirmé', tone: 'brand' },
  in_progress: { label: 'En cours', tone: 'success' },
  suspended: { label: 'Suspendu', tone: 'warning' },
  completed: { label: 'Terminé', tone: 'neutral' },
  cancelled: { label: 'Arrêté', tone: 'neutral' },
};

const SESSION_STATUS: Record<SessionStatus, Status> = {
  to_assign: { label: 'À affecter', tone: 'warning' },
  assigned: { label: 'Planifiée', tone: 'brand' },
  in_progress: { label: 'En cours', tone: 'success' },
  interrupted: { label: 'Interrompue', tone: 'danger' },
  completed: { label: 'Réalisée', tone: 'neutral' },
  missed: { label: 'Client absent', tone: 'neutral' },
  suspended: { label: 'Suspendue', tone: 'warning' },
  cancelled: { label: 'Annulée', tone: 'neutral' },
};

const PAYMENT_STATUS: Record<PaymentStatus, Status> = {
  not_due: { label: 'Pas encore due', tone: 'neutral' },
  due: { label: 'À payer', tone: 'accent' },
  paid: { label: 'Payée', tone: 'success' },
  overdue: { label: 'Impayée', tone: 'danger' },
  waived: { label: 'Offerte', tone: 'neutral' },
};

const lookup =
  <K extends string>(entries: Record<K, Status>) =>
  (code: K | string): Status =>
    (entries as Record<string, Status>)[code] ?? { label: code, tone: 'neutral' };

export const programStatus = lookup(PROGRAM_STATUS);
export const sessionStatus = lookup(SESSION_STATUS);
export const paymentStatus = lookup(PAYMENT_STATUS);

const names =
  <K extends string>(entries: Record<K, string>) =>
  (code: K | string): string =>
    (entries as Record<string, string>)[code] ?? code;

/** Causes de suspension cumulables (R-SU-01). */
export const suspensionCause = names<SuspensionCause>({
  overdue_sessions: 'séances impayées',
  unpaid_invoices: 'factures impayées',
  ksp_decision: 'décision de KSP',
  organization_suspended: 'organisation suspendue',
});

export const sessionCancelCause = names<SessionCancelCause>({
  customer: 'annulée par le client',
  customer_late: 'annulée tard par le client (50 % dus)',
  ksp: 'annulée par KSP',
  no_agent: 'aucun agent disponible',
  program_stopped: 'programme arrêté',
});

export const incidentCategory = names<IncidentCategory>({
  equipment: 'Matériel',
  access: 'Accès',
  safety: 'Sécurité',
  out_of_scope_request: 'Demande hors devis',
  other: 'Autre',
});

export const payerKindName = (kind: string): string =>
  ({ individual: 'Particulier', organization: 'Entreprise' })[kind] ?? kind;

export const programSortName = (sort: ProgramSort): string =>
  ({ '-createdAt': 'Plus récents d’abord', createdAt: 'Plus anciens d’abord' })[sort];

const UNPAID: readonly SuspensionCause[] = ['overdue_sessions', 'unpaid_invoices'];

/** Impayés signalés par le contrat : causes de suspension « séances » ou « factures » impayées. */
export const hasUnpaid = (program: Pick<Program, 'suspensionCauses'>) =>
  program.suspensionCauses.some((cause) => UNPAID.includes(cause.cause));

/** Ce que l'équipe doit faire du programme, ou pourquoi elle n'a rien à faire. */
export function programNextStep(program: Program): { label: string; action: boolean } {
  const t = programsTexts.list;
  if (program.pendingCancellation) return { label: 'Valider ou laisser l’arrêt demandé', action: true };
  if (program.status === 'completed' || program.status === 'cancelled')
    return { label: t.closed, action: false };
  if (program.status === 'suspended') {
    const causes = program.suspensionCauses.map((cause) => suspensionCause(cause.cause)).join(', ');
    return { label: causes ? `Suspendu : ${causes}` : 'Suspendu', action: true };
  }
  return { label: t.nothing, action: false };
}
