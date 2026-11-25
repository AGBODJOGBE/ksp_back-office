'use client';

import Link from 'next/link';
import { Panel } from '@/components/ui/panel';
import { ResourceView } from '@/components/ui/resource-view';
import { apiErrorText } from '@/lib/api';
import { useResource } from '@/lib/use-resource';
import { countLabel, QUEUE_LIMIT } from '@/lib/work-queue';
import { listCreditRequests, listWithdrawals } from '@/features/wallet/requests-api';
import { pendingTexts as t } from '@/features/wallet/requests-texts';
import { walletPaths } from '@/features/wallet/texts';

type Count = { count: number; more: boolean };
const counted = (items: readonly unknown[], nextCursor: string | null): Count => ({
  count: items.length,
  more: nextCursor !== null,
});

/** Trois lectures d'une page (au plus `QUEUE_LIMIT`) : « 20+ » au-delà, comme « Ma journée ». */
async function loadPending() {
  const [toProcess, toApprove, credits] = await Promise.all([
    listWithdrawals({ status: 'requested' }, undefined, QUEUE_LIMIT),
    listWithdrawals({ status: 'awaiting_approval' }, undefined, QUEUE_LIMIT),
    listCreditRequests('pending_approval', undefined, QUEUE_LIMIT),
  ]);
  return [
    {
      href: `${walletPaths.withdrawals}?etat=requested`,
      label: t.withdrawalsToProcess,
      ...counted(toProcess.data, toProcess.nextCursor),
    },
    {
      href: `${walletPaths.withdrawals}?etat=awaiting_approval`,
      label: t.withdrawalsToApprove,
      ...counted(toApprove.data, toApprove.nextCursor),
    },
    {
      href: `${walletPaths.creditRequests}?etat=pending_approval`,
      label: t.creditRequests,
      ...counted(credits.items, credits.nextCursor),
    },
  ];
}

/**
 * Ce qui attend la finance dans les portefeuilles, en tête de la vue d'ensemble : un lien par file
 * (déjà filtrée) avec son compteur ; les files vides ne sont pas montrées.
 */
export function PendingSummary() {
  const resource = useResource(loadPending);
  return (
    <Panel title={t.title} id="portefeuilles-en-attente">
      <ResourceView resource={resource} lines={2} labels={t} describe={apiErrorText}>
        {(items) => {
          const open = items.filter((item) => item.count > 0);
          if (open.length === 0) return <p className="text-small text-ink-muted">{t.nothing}</p>;
          return (
            <ul className="grid gap-2 sm:grid-cols-3">
              {open.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="rounded-control border-line hover:border-line-strong text-accent-ink flex min-h-11 items-center border px-3 py-2 font-semibold underline-offset-4 hover:underline"
                  >
                    {item.label(countLabel(item))}
                  </Link>
                </li>
              ))}
            </ul>
          );
        }}
      </ResourceView>
    </Panel>
  );
}
