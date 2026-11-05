// Point d'entrée `@/features/cleaning/queue` : lu seulement par la file « À traiter » du tableau de bord (navigateur).
import { formatDateTime } from '@/lib/format';
import { toQueuePage, type WorkQueueSection } from '@/lib/work-queue';
import { CLEANING_ROLES, cleaningAccess } from './access';
import { listMissions, listRequests, listVisits } from './api';
import { cleaningPaths } from './paths';
import { cleaningTexts, customerLabel } from './texts';

const t = cleaningTexts.queue;
const { supervisor, admin, agent, superAdmin } = CLEANING_ROLES;

/** Rôles du contrat (`x-ksp-roles`) : missions et visites, ouvertes à l'agent ; demandes, à la supervision. */
const FIELD_ROLES = [supervisor, agent, admin, superAdmin];
const SUPERVISION_ROLES = [supervisor, admin, superAdmin];

const visitsToReport = `${cleaningPaths.visits}?etat=scheduled&periode=passee`;

/**
 * Sections du Nettoyage dans la file « À traiter ». Chaque lecture reprend les filtres du contrat et une
 * page de 20 (`PAGE_SIZE`) ; un agent ne reçoit que ses missions et ses visites (gateway).
 */
export const cleaningQueueSections: readonly WorkQueueSection[] = [
  {
    // `GET /admin/cleaning/missions?status=on_hold`.
    id: 'cleaning-incidents',
    title: t.incidents.title,
    description: t.incidents.description,
    roles: FIELD_ROLES,
    seeAll: { href: `${cleaningPaths.missions}?etat=on_hold`, label: t.incidents.seeAll },
    load: async () =>
      toQueuePage(await listMissions('on_hold'), (mission) => {
        // Passage mis en attente par un incident, s'il figure dans la mission (sinon, la mission).
        const passage = mission.interventions.find((item) => item.status === 'on_hold');
        return {
          id: mission.id,
          title: customerLabel(mission),
          details: [
            mission.commune,
            passage ? t.incidents.passage(formatDateTime(passage.scheduledStart)) : '',
            passage?.incidentNote ?? '',
          ].filter(Boolean),
          action: passage
            ? {
                kind: 'link',
                href: cleaningPaths.intervention(mission.id, passage.id),
                label: t.incidents.action,
              }
            : { kind: 'link', href: cleaningPaths.mission(mission.id), label: t.incidents.missionAction },
        };
      }),
  },
  {
    // `GET /admin/cleaning/visits?status=scheduled&to=<maintenant>` : `to` est exclu.
    id: 'cleaning-visit-reports',
    title: t.reports.title,
    description: t.reports.description,
    roles: FIELD_ROLES,
    seeAll: { href: visitsToReport, label: t.reports.seeAll },
    load: async (roles) => {
      // La fiche d'une demande est réservée à la supervision : l'agent saisit son compte rendu dans la liste.
      const supervise = cleaningAccess(roles).supervise;
      const page = await listVisits({ status: 'scheduled', to: new Date().toISOString() });
      return toQueuePage(page, (visit) => {
        const first = visit.requests[0];
        return {
          id: visit.id,
          title: customerLabel(visit),
          details: [
            visit.requests.map((request) => request.serviceName ?? request.serviceCode).join(', '),
            visit.commune,
            t.reports.scheduled(formatDateTime(visit.scheduledAt)),
            visit.agentName ?? '',
          ].filter(Boolean),
          action: {
            kind: 'link',
            href: supervise && first ? cleaningPaths.request(first.requestId) : visitsToReport,
            label: t.reports.action,
          },
        };
      });
    },
  },
  {
    // `GET /admin/cleaning/quote-requests?status=received`.
    id: 'cleaning-requests-to-visit',
    title: t.toVisit.title,
    description: t.toVisit.description,
    roles: SUPERVISION_ROLES,
    seeAll: { href: `${cleaningPaths.requests}?etat=received`, label: t.toVisit.seeAll },
    load: async () =>
      toQueuePage(await listRequests({ status: 'received' }), (request) => ({
        id: request.id,
        title: customerLabel(request),
        details: [
          request.serviceName ?? request.serviceCode,
          request.commune,
          t.toVisit.received(formatDateTime(request.createdAt)),
        ].filter(Boolean),
        action: { kind: 'link', href: cleaningPaths.request(request.id), label: t.toVisit.action },
      })),
  },
];
