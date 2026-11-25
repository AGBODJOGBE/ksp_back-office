// Point d'entrée `@/features/recovery/queue` : lu seulement par la file « À traiter » du tableau de bord (navigateur).
import { formatDate, formatDateTime, formatXof } from '@/lib/format';
import {
  QUEUE_LIMIT,
  QUEUE_ROWS,
  toQueuePage,
  type WorkQueuePage,
  type WorkQueueSection,
} from '@/lib/work-queue';
import { rolesFor } from './access';
import { getMyDay } from './api';
import { listOfflinePayments } from './offline-api';
import type { OfflinePayment } from './offline-schemas';
import { offlineSourceLabel, offlineTexts } from './offline-texts';
import { recoveryPaths } from './paths';
import { recoveryQueueTexts as t, workItemLabel } from './queue-texts';
import type { WorkItem, WorkItemKind, WorkQueue } from './schemas';
import { actorName } from './texts';

/*
 * Sections du Recouvrement dans Ma journée. Une seule route (`GET /recovery/my-day`, file du chargé
 * triée par le service) alimente quatre sections, par nature de tâche : les sections qui s'ouvrent
 * ensemble partagent la même lecture (une requête en cours est réutilisée). Le service renvoie toute
 * la file : le compteur est exact. Chaque ligne mène à la fiche du dossier. Pour la finance, une
 * cinquième section lit les paiements hors ligne à valider (`GET /recovery/offline-payments`).
 */

let inFlight: Promise<WorkQueue> | null = null;

/** File du jour, lue une fois pour toutes les sections affichées ensemble. */
function sharedMyDay(): Promise<WorkQueue> {
  inFlight ??= getMyDay().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

function row(item: WorkItem) {
  const details = [
    workItemLabel(item.kind),
    t.due(formatDateTime(item.dueAt)),
    t.amountDue(formatXof(item.case.due)),
    item.note?.trim() ?? '',
  ].filter(Boolean);
  return {
    id: `${item.kind}-${item.case.id}-${item.dueAt}`,
    title: t.dossier(item.case.number, item.case.debtorName),
    details,
    action: { kind: 'link' as const, href: recoveryPaths.case(item.case.id), label: t.open },
  };
}

function section(
  id: string,
  texts: { title: string; description: string },
  kinds: readonly WorkItemKind[],
): WorkQueueSection {
  return {
    id,
    title: texts.title,
    description: texts.description,
    roles: rolesFor('myDay'),
    seeAll: { href: recoveryPaths.cases, label: t.seeAll },
    load: async (): Promise<WorkQueuePage> => {
      const items = (await sharedMyDay()).items.filter((item) => kinds.includes(item.kind));
      return { rows: items.slice(0, QUEUE_ROWS).map(row), count: items.length, more: false };
    },
  };
}

/** Paiement hors ligne à valider : la ligne mène à la file, où se font validation et refus. */
function offlineRow(payment: OfflinePayment) {
  const q = offlineTexts.queue;
  return {
    id: `offline-${payment.id}`,
    title: q.row(formatXof(payment.amount), payment.caseNumber),
    details: [
      offlineSourceLabel(payment.source),
      q.received(formatDate(`${payment.receivedOn}T12:00:00+01:00`)),
      q.by(actorName(payment.recordedBy)),
    ],
    action: { kind: 'link' as const, href: recoveryPaths.offlinePayments, label: q.open },
  };
}

const offlineSection: WorkQueueSection = {
  id: 'recovery-offline-payments',
  title: offlineTexts.queue.title,
  description: offlineTexts.queue.description,
  roles: rolesFor('offlinePayments'),
  seeAll: { href: recoveryPaths.offlinePayments, label: offlineTexts.queue.seeAll },
  load: async () =>
    toQueuePage(await listOfflinePayments({ status: 'pending_approval' }, QUEUE_LIMIT)(), offlineRow),
};

export const RECOVERY_QUEUE_IDS = [
  'recovery-offline-payments',
  'recovery-callbacks',
  'recovery-promises',
  'recovery-reminders',
  'recovery-decisions',
] as const;

export const recoveryQueueSections: readonly WorkQueueSection[] = [
  offlineSection,
  section(RECOVERY_QUEUE_IDS[1], t.callbacks, ['promised_callback', 'callback_request']),
  section(RECOVERY_QUEUE_IDS[2], t.promises, ['broken_promise', 'missed_installment']),
  section(RECOVERY_QUEUE_IDS[3], t.reminders, ['reminder_due']),
  section(RECOVERY_QUEUE_IDS[4], t.decisions, ['dispute', 'plan_to_validate']),
];
