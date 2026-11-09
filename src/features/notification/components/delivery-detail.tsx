'use client';

import Link from 'next/link';
import { useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { BackLink } from '@/components/ui/back-link';
import { DescriptionList } from '@/components/ui/description-list';
import { FormMessage } from '@/components/ui/field';
import { Heading } from '@/components/ui/heading';
import { Panel } from '@/components/ui/panel';
import { ResourceView } from '@/components/ui/resource-view';
import { ApiError, apiErrorText } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useResource } from '@/lib/use-resource';
import { getDelivery } from '@/features/notification/api';
import type { Delivery } from '@/features/notification/schemas';
import {
  channelName,
  deliveryStatus,
  failureReason,
  notificationPaths,
  notificationTexts,
} from '@/features/notification/texts';

const t = notificationTexts.delivery;
const isNotFound = (error: unknown) => error instanceof ApiError && error.status === 404;
const describe = (error: unknown) => (isNotFound(error) ? t.notFound : apiErrorText(error));

function Attempts({ delivery }: { delivery: Delivery }) {
  const tried = delivery.channelsTried.length ? delivery.channelsTried : [delivery.requestedChannel];
  return (
    <ol className="grid gap-2">
      {tried.map((channel, index) => {
        const used = channel === delivery.channelUsed;
        return (
          <li key={`${channel}-${index}`} className="flex flex-wrap items-center gap-2">
            <span className="text-ink-muted tabular-nums">{index + 1}.</span>
            <span className="text-ink font-medium">{channelName(channel)}</span>
            {used ? <Badge tone="success">{t.used}</Badge> : null}
          </li>
        );
      })}
    </ol>
  );
}

function DeliveryView({ delivery }: { delivery: Delivery }) {
  const status = deliveryStatus(delivery.status);
  const date = (value: string | null) => (value ? formatDateTime(value) : null);
  return (
    <div className="grid gap-6">
      <div className="grid gap-3">
        <Heading as="h1" size="h2" className="break-words">
          {t.title(delivery.templateCode)}
        </Heading>
        <div>
          <Badge tone={status.tone} dot>
            {status.label}
          </Badge>
        </div>
        {delivery.erased ? <FormMessage tone="info">{t.erased}</FormMessage> : null}
      </div>
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <Panel title={t.summary} id="envoi-resume">
          <DescriptionList
            items={[
              { term: t.requestedChannel, value: channelName(delivery.requestedChannel) },
              { term: t.channelUsed, value: delivery.channelUsed ? channelName(delivery.channelUsed) : null },
              { term: t.target, value: delivery.targetMasked },
              {
                term: t.recipient,
                value: delivery.recipientUserId ? (
                  <Link
                    href={notificationPaths.forRecipient(delivery.recipientUserId)}
                    className="text-accent-ink font-mono text-sm font-semibold underline"
                    title={t.otherDeliveries}
                  >
                    {delivery.recipientUserId}
                  </Link>
                ) : null,
              },
              { term: t.created, value: date(delivery.createdAt) },
              { term: t.accepted, value: date(delivery.acceptedAt) },
              { term: t.failed, value: date(delivery.failedAt) },
              { term: t.expires, value: date(delivery.expiresAt) },
              {
                term: t.provider,
                value: delivery.providerMessageId ? (
                  <span className="font-mono text-sm break-all">{delivery.providerMessageId}</span>
                ) : null,
              },
            ]}
          />
          <p className="text-small text-ink-muted">{t.noText}</p>
        </Panel>
        <Panel title={t.attempts} id="envoi-canaux">
          <p className="text-small text-ink-muted">{t.attemptsHint}</p>
          <Attempts delivery={delivery} />
          {delivery.failureReason || delivery.errorCode ? (
            <DescriptionList
              items={[
                {
                  term: t.failure,
                  value: delivery.failureReason ? failureReason(delivery.failureReason) : null,
                },
                {
                  term: t.errorCode,
                  value: delivery.errorCode ? <code className="text-sm">{delivery.errorCode}</code> : null,
                },
              ]}
            />
          ) : null}
        </Panel>
      </div>
    </div>
  );
}

/** Détail d'un envoi : canaux essayés, cause d'échec, dates ; jamais le texte ni une coordonnée en clair. */
export function DeliveryDetail({ id }: { id: string }) {
  const delivery = useResource(useCallback(() => getDelivery(id), [id]));
  return (
    <div className="grid gap-4">
      <BackLink href={notificationPaths.deliveries}>{t.back}</BackLink>
      <ResourceView
        resource={delivery}
        lines={6}
        labels={notificationTexts}
        describe={describe}
        retryable={(error) => !isNotFound(error)}
      >
        {(data) => <DeliveryView delivery={data} />}
      </ResourceView>
    </div>
  );
}
