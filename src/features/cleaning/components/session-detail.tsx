'use client';

import Link from 'next/link';
import { useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { DescriptionList } from '@/components/ui/description-list';
import { Heading } from '@/components/ui/heading';
import { beninDay, formatDateTime, formatSlot } from '@/lib/format';
import { useResource } from '@/lib/use-resource';
import type { CleaningAccess } from '@/features/cleaning/access';
import { cleaningPaths } from '@/features/cleaning/paths';
import { getSession } from '@/features/cleaning/programs-api';
import type { CleaningSession } from '@/features/cleaning/programs-schemas';
import { sessionCancelCause, sessionStatus } from '@/features/cleaning/programs-texts';
import { agentConfirmation } from '@/features/cleaning/request-detail-texts';
import { sessionsTexts, sessionTexts } from '@/features/cleaning/session-texts';
import { cleaningTexts } from '@/features/cleaning/texts';
import { Amount, BackLink, LoadingBlock, Note, Panel, ResourceView, useCleaningAccess } from './parts';
import { PaymentCell } from './program-sessions';
import { SessionActions } from './session-actions';
import { SessionChecklist, SessionIncidents, SessionPhotos } from './session-content';

const t = sessionTexts;
const link = 'text-accent-ink inline-flex min-h-11 items-center font-semibold underline';

/** Ce que chaque partie du détail reçoit : la séance, sa mise à jour et les droits. */
export interface SessionProps {
  session: CleaningSession;
  onChange: (session: CleaningSession) => void;
  access: CleaningAccess;
}

function Summary({ session }: { session: CleaningSession }) {
  const customer = session.organizationName ?? session.customerName;
  const arrival = session.arrival;
  const cancellation = session.cancellation;
  return (
    <DescriptionList
      items={[
        {
          term: t.program,
          value: (
            <Link href={cleaningPaths.program(session.programId)} className={link}>
              {session.programNumber}
            </Link>
          ),
        },
        { term: t.customer, value: customer?.trim() || null },
        { term: t.when, value: formatSlot({ start: session.scheduledStart, end: session.scheduledEnd }) },
        { term: t.payment, value: <PaymentCell session={session} /> },
        { term: t.price, value: <Amount value={session.price} /> },
        { term: t.amountDue, value: <Amount value={session.amountDue} /> },
        {
          term: t.visitFee,
          value: session.visitFeeDeduction === null ? null : <Amount value={session.visitFeeDeduction} />,
        },
        { term: t.invoice, value: session.invoiceId ? t.invoiceYes : null },
        { term: t.started, value: session.startedAt ? formatDateTime(session.startedAt) : null },
        { term: t.completed, value: session.completedAt ? formatDateTime(session.completedAt) : null },
        {
          term: t.arrival,
          value: arrival ? (
            <span className="flex flex-wrap items-center gap-2">
              {t.arrivalValue(formatDateTime(arrival.arrivedAt), arrival.distanceMeters)}
              {arrival.uncertain ? <span className="text-ink-muted">({t.arrivalUncertain})</span> : null}
              {arrival.alert ? <Badge tone="warning">{t.arrivalAlert}</Badge> : null}
            </span>
          ) : null,
        },
        { term: t.signed, value: session.signed ? cleaningTexts.common.yes : null },
        {
          term: t.rating,
          value: session.rating ? t.ratingValue(session.rating.stars, session.rating.comment) : null,
        },
        { term: t.claims, value: session.claimIds.length ? t.claimsCount(session.claimIds.length) : null },
        {
          term: t.reschedules,
          value: session.reschedules.length ? (
            <ul className="grid gap-1">
              {session.reschedules.map((item) => (
                <li key={item.at}>
                  {t.rescheduleItem(
                    formatDateTime(item.previousStart),
                    formatDateTime(item.newStart),
                    t.rescheduleBy[item.by] ?? item.by,
                  )}
                  {item.reason ? <span className="text-ink-muted"> — {item.reason}</span> : null}
                </li>
              ))}
            </ul>
          ) : null,
        },
        {
          term: t.cancellation,
          value: cancellation
            ? `${sessionCancelCause(cancellation.cause)}, ${formatDateTime(cancellation.at)}${cancellation.reason ? ` — ${cancellation.reason}` : ''}`
            : null,
        },
      ]}
    />
  );
}

function Team({ session }: { session: CleaningSession }) {
  return (
    <div className="grid gap-3">
      {session.agents.length ? (
        <ul className="grid gap-1">
          {session.agents.map((agent) => (
            <li key={agent.agentId}>
              <Link
                href={cleaningPaths.agent(agent.agentId)}
                className="text-ink font-semibold underline-offset-4 hover:underline"
              >
                {agent.firstName} {agent.lastName}
              </Link>
              <span className="text-small text-ink-muted">
                {' '}
                (
                {[agent.isLead ? t.lead : null, agentConfirmation(agent.confirmation)]
                  .filter(Boolean)
                  .join(', ')}
                )
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <Note>{t.noAgent}</Note>
      )}
      <p className="text-small text-ink-muted">{t.teamHint}</p>
      <Link href={cleaningPaths.planningDay(beninDay(session.scheduledStart))} className={link}>
        {t.openPlanning}
      </Link>
    </div>
  );
}

function SessionView(props: SessionProps) {
  const { session } = props;
  const status = sessionStatus(session.status);
  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Heading as="h1" size="h2">
          {t.title(session.rank, session.sessionsCount)}
        </Heading>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={status.tone} dot>
            {status.label}
          </Badge>
          {session.isRedo ? <Badge tone="neutral">{sessionsTexts.redo}</Badge> : null}
          <span className="text-small text-ink-muted">{session.programNumber}</span>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel title={t.summary} id="seance-resume">
          <Summary session={session} />
        </Panel>
        <div className="grid content-start gap-4">
          <Panel title={t.team} id="seance-equipe">
            <Team session={session} />
          </Panel>
          <SessionActions {...props} />
        </div>
      </div>
      <SessionPhotos {...props} />
      <div className="grid gap-4 lg:grid-cols-2">
        <SessionChecklist session={session} />
        <SessionIncidents session={session} />
      </div>
    </div>
  );
}

function SessionScreen({ id, access }: { id: string; access: CleaningAccess }) {
  const session = useResource(useCallback(() => getSession(id), [id]));
  return (
    <ResourceView resource={session} lines={10}>
      {(data) => <SessionView session={data} onChange={session.set} access={access} />}
    </ResourceView>
  );
}

/** Détail d'une séance (`/nettoyage/programmes/[id]/seances/[sessionId]`). */
export function SessionDetail({ programId, sessionId }: { programId: string; sessionId: string }) {
  const access = useCleaningAccess();
  return (
    <div className="grid gap-4">
      <BackLink href={cleaningPaths.program(programId)}>{t.backToProgram}</BackLink>
      {!access ? (
        <LoadingBlock lines={8} />
      ) : access['cleaning.program.read'] ? (
        <SessionScreen id={sessionId} access={access} />
      ) : (
        <Note>{cleaningTexts.common.forbidden}</Note>
      )}
    </div>
  );
}
