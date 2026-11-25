// Point d'entrée `@/features/wallet/queue` : lu seulement par la file « À traiter » du tableau de bord (navigateur).
import { formatDateTime, formatXof } from '@/lib/format';
import { QUEUE_LIMIT, toQueuePage, type WorkQueueSection } from '@/lib/work-queue';
import { WALLET_ROLES } from './access';
import { CreditRequestActions } from './components/credit-request-actions';
import { WithdrawalActions } from './components/withdrawal-actions';
import { listCreditRequests, listWithdrawals } from './requests-api';
import type { Withdrawal } from './requests-schemas';
import { creditKind, holderKind, operatorName, pendingTexts } from './requests-texts';
import { walletPaths } from './texts';

const t = pendingTexts.queue;
const ACTIONS = 'flex w-full flex-wrap gap-2 sm:w-auto';

function withdrawalSection(
  id: string,
  status: 'requested' | 'awaiting_approval',
  texts: { title: string; description: string; seeAll: string },
): WorkQueueSection {
  return {
    id,
    title: texts.title,
    description: texts.description,
    roles: WALLET_ROLES,
    seeAll: { href: `${walletPaths.withdrawals}?etat=${status}`, label: texts.seeAll },
    load: async () =>
      toQueuePage(await listWithdrawals({ status }, undefined, QUEUE_LIMIT), (w: Withdrawal) => ({
        id: w.id,
        title: `${formatXof(w.amount)} · ${holderKind(w.holder.type)}`,
        details: [
          `${w.beneficiaryPhoneMasked} (${operatorName(w.beneficiaryOperator)})`,
          t.requestedOn(formatDateTime(w.requestedAt)),
        ],
        action: {
          kind: 'inline',
          render: (done) => (
            <WithdrawalActions
              withdrawal={w}
              handlers={{ onDone: done, onStale: done }}
              className={ACTIONS}
            />
          ),
        },
      })),
  };
}

/**
 * Ce qui attend la finance dans les portefeuilles (rôles des routes `/admin/wallet/*`) : retraits à
 * valider (deuxième personne), retraits à traiter, demandes de crédit au-delà du seuil. Les décisions se
 * prennent sur la ligne, confirmées, comme dans les listes ; la section est relue après chacune.
 */
export const walletQueueSections: readonly WorkQueueSection[] = [
  withdrawalSection('wallet-withdrawals-to-approve', 'awaiting_approval', t.toApprove),
  withdrawalSection('wallet-withdrawals-to-process', 'requested', t.toProcess),
  {
    id: 'wallet-credit-requests',
    title: t.credits.title,
    description: t.credits.description,
    roles: WALLET_ROLES,
    seeAll: { href: `${walletPaths.creditRequests}?etat=pending_approval`, label: t.credits.seeAll },
    load: async () => {
      const page = await listCreditRequests('pending_approval', undefined, QUEUE_LIMIT);
      return toQueuePage({ data: page.items, nextCursor: page.nextCursor }, (request) => ({
        id: request.id,
        title: `${formatXof(request.amount)} · ${creditKind(request.kind)}`,
        details: [
          holderKind(request.holder.type),
          request.reason,
          t.requestedOn(formatDateTime(request.requestedAt)),
        ],
        action: {
          kind: 'inline',
          render: (done) => (
            <CreditRequestActions
              request={request}
              handlers={{ onDone: done, onStale: done }}
              className={ACTIONS}
            />
          ),
        },
      }));
    },
  },
];
