// Point d'entrée `@/features/cleaning/queue` : lu seulement par la file « À traiter » du tableau de bord (navigateur).
import { beninDay, formatDate, formatDateTime } from '@/lib/format';
import { QUEUE_ROWS, type WorkQueuePage, type WorkQueueRow, type WorkQueueSection } from '@/lib/work-queue';
import { rolesWith } from './access';
import { listAgents } from './agents-api';
import { agentName, agentStatus, APPLICATION_STATUSES } from './agents-texts';
import { listClaims } from './claims-api';
import { claimCategory, claimCustomer, claimNextStep, claimsTexts, responseLate } from './claims-texts';
import { cleaningPaths } from './paths';
import { listUnassigned } from './planning-api';
import { planningTexts } from './planning-texts';
import { listRequests } from './requests-api';
import type { RequestStatus, RequestSummary } from './requests-schemas';
import { cleaningQueueTexts as t } from './queue-texts';

/*
 * Sections du Nettoyage v2 dans la file « À traiter » (ordre : `QUEUE_ORDER` du tableau de bord). Les
 * listes du service cleaning donnent leur `total` : le compteur est exact, pas « 20+ ». Chaque section
 * suit la permission de la route (rôles par défaut du contrat, `access.ts`) et mène à l'écran filtré.
 * Les arrêts de programme à valider n'ont pas de section : `GET /programs` n'a pas de filtre sur
 * `pendingCancellation` (manque du contrat).
 */

type Listed<T> = { data: readonly T[]; total: number };

/** Pages de la gateway (une ou deux listes) → page de la file : `QUEUE_ROWS` lignes, total exact. */
function fromTotals<T>(pages: readonly Listed<T>[], row: (item: T) => WorkQueueRow): WorkQueuePage {
  const items = pages.flatMap((page) => page.data);
  const count = pages.reduce((sum, page) => sum + page.total, 0);
  return { rows: items.slice(0, QUEUE_ROWS).map(row), count, more: false };
}

/** Geste attendu sur une réclamation, ou « Ouvrir » quand le service attend autre chose. */
const claimAction = (claim: Parameters<typeof claimNextStep>[0]) => {
  const step = claimNextStep(claim);
  return step.action ? step.label : t.claims.open;
};

const withStatus = (base: string, status: string) => `${base}?statut=${encodeURIComponent(status)}`;

/** Ligne d'un dossier : numéro, client, lieu et commune ; action sur la fiche. */
function requestRow(action: string) {
  return (item: RequestSummary): WorkQueueRow => {
    const name = item.customerKind === 'organization' ? item.organizationName : item.customerName;
    return {
      id: item.id,
      title: t.dossier(item.number),
      details: [name?.trim() || t.noName, item.placeTypeName, item.communeName],
      action: { kind: 'link', href: cleaningPaths.request(item.id), label: action },
    };
  };
}

function requestSection(
  id: string,
  status: RequestStatus,
  texts: { title: string; description: string; seeAll: string; action: string },
  roles: readonly string[],
): WorkQueueSection {
  return {
    id,
    title: texts.title,
    description: texts.description,
    roles,
    seeAll: { href: withStatus(cleaningPaths.requests, status), label: texts.seeAll },
    load: async () => fromTotals([await listRequests({ status })()], requestRow(texts.action)),
  };
}

export const cleaningQueueSections: readonly WorkQueueSection[] = [
  requestSection(
    'cleaning-visits-to-schedule',
    'visit_to_schedule',
    t.visitToSchedule,
    rolesWith('cleaning.request.process'),
  ),
  requestSection('cleaning-visits-done', 'visit_done', t.visitDone, rolesWith('cleaning.quote.manage')),
  {
    id: 'cleaning-unassigned',
    title: t.unassigned.title,
    description: t.unassigned.description,
    roles: rolesWith('cleaning.planning.manage'),
    seeAll: { href: cleaningPaths.planning, label: t.unassigned.seeAll },
    load: async () =>
      fromTotals([await listUnassigned()()], (item) => ({
        id: `${item.kind}-${item.id}`,
        title: planningTexts.itemTitle(item.kind, item.number, item.rank),
        details: [
          formatDateTime(item.start),
          item.communeName,
          item.late ? t.unassigned.late : item.urgent ? t.unassigned.urgent : '',
        ].filter(Boolean),
        action: {
          kind: 'link',
          href: cleaningPaths.planningDay(beninDay(item.start)),
          label: t.unassigned.action,
        },
      })),
  },
  {
    id: 'cleaning-agent-applications',
    title: t.applications.title,
    description: t.applications.description,
    roles: rolesWith('cleaning.agent.manage'),
    seeAll: { href: withStatus(cleaningPaths.team, APPLICATION_STATUSES[0]), label: t.applications.seeAll },
    load: async () =>
      fromTotals(
        await Promise.all(APPLICATION_STATUSES.map((status) => listAgents({ status, sort: '-createdAt' })())),
        (agent) => ({
          id: agent.id,
          title: agentName(agent),
          details: [agentStatus(agent.status).label, formatDate(agent.createdAt)],
          action: { kind: 'link', href: cleaningPaths.agent(agent.id), label: t.applications.action },
        }),
      ),
  },
  {
    id: 'cleaning-claims',
    title: t.claims.title,
    description: t.claims.description,
    roles: rolesWith('cleaning.claim.manage'),
    seeAll: { href: withStatus(cleaningPaths.claims, 'open'), label: t.claims.seeAll },
    load: async () => {
      const now = Date.now();
      const pages = await Promise.all(
        (['open', 'in_progress'] as const).map((status) => listClaims({ status })()),
      );
      return fromTotals(pages, (claim) => ({
        id: claim.id,
        title: claimsTexts.detail.heading(claimCategory(claim.category)),
        details: [
          claimCustomer(claim) ?? t.noName,
          formatDateTime(claim.openedAt),
          responseLate(claim, now) ? t.claims.late : '',
        ].filter(Boolean),
        action: { kind: 'link', href: cleaningPaths.claim(claim.id), label: claimAction(claim) },
      }));
    },
  },
];
