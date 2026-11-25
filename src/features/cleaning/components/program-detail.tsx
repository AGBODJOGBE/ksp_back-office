'use client';

import Link from 'next/link';
import { type ReactNode, useCallback, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { DescriptionList } from '@/components/ui/description-list';
import { FormMessage } from '@/components/ui/field';
import { Heading } from '@/components/ui/heading';
import { formatDate, formatDateTime } from '@/lib/format';
import { useSession } from '@/lib/api';
import { useResource } from '@/lib/use-resource';
import type { CleaningAccess } from '@/features/cleaning/access';
import { cleaningPaths } from '@/features/cleaning/paths';
import { programDetailTexts } from '@/features/cleaning/program-detail-texts';
import { getProgram } from '@/features/cleaning/programs-api';
import type { Program } from '@/features/cleaning/programs-schemas';
import { payerKindName, programStatus, suspensionCause } from '@/features/cleaning/programs-texts';
import { describeSchedule } from '@/features/cleaning/schedule-plan';
import { cleaningTexts } from '@/features/cleaning/texts';
import { Amount, BackLink, LoadingBlock, Note, Panel, ResourceView, useCleaningAccess } from './parts';
import { isClosedProgram, ProgramActions, type ProgramForm } from './program-actions';
import { AmendmentForm } from './program-amendment';
import { ScheduleChangeForm } from './program-schedule-change';
import { customerOf, ProgramFlags } from './programs-list';
import { ProgramSessions } from './program-sessions';

const t = programDetailTexts;

/** Ce que chaque partie de la fiche reçoit : le programme, sa mise à jour et les droits. */
export interface ProgramProps {
  program: Program;
  /** Remplace le programme affiché par la réponse d'une décision, et relit l'échéancier. */
  onChange: (program: Program) => void;
  access: CleaningAccess;
}

function Header({ program }: { program: Program }) {
  const status = programStatus(program.status);
  return (
    <div className="grid gap-2">
      <Heading as="h1" size="h2">
        {program.number}
      </Heading>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={status.tone} dot>
          {status.label}
        </Badge>
        <ProgramFlags program={program} />
        <span className="text-small text-ink-muted">
          {t.created} {formatDate(program.createdAt)}
        </span>
      </div>
    </div>
  );
}

function Summary({ program }: { program: Program }) {
  const place = program.place;
  const period =
    program.firstSessionAt && program.lastSessionAt
      ? t.periodValue(formatDate(program.firstSessionAt), formatDate(program.lastSessionAt))
      : t.noPeriod;
  return (
    <DescriptionList
      items={[
        {
          term: t.customer,
          value: customerOf(program) ?? <span className="text-ink-muted">{t.noName}</span>,
        },
        { term: t.payer, value: payerKindName(program.payerKind) },
        {
          term: t.place,
          value: `${place.name} — ${place.placeTypeName}, ${place.communeName}`,
        },
        { term: t.offers, value: program.cleaningTypes.map((type) => type.name).join(', ') },
        { term: t.frequency, value: describeSchedule(program.schedule) },
        { term: t.period, value: period },
        { term: t.progress, value: t.progressValue(program.sessionsCompleted, program.sessionsCount) },
        { term: t.sessionPrice, value: <Amount value={program.sessionPrice} /> },
        { term: t.total, value: <Amount value={program.total} /> },
        {
          term: t.suspension,
          value: program.suspensionCauses.length ? (
            <ul className="grid gap-1">
              {program.suspensionCauses.map((cause) => (
                <li key={cause.cause}>
                  {t.suspensionSince(suspensionCause(cause.cause), formatDateTime(cause.since))}
                  {cause.reason ? <span className="text-ink-muted"> — {cause.reason}</span> : null}
                </li>
              ))}
            </ul>
          ) : null,
        },
        {
          term: t.renewal,
          value: program.renewal
            ? `${t.renewalStatus[program.renewal.status] ?? program.renewal.status}, ${formatDate(program.renewal.proposedAt)}${program.renewal.visitRequired ? ` (${t.renewalVisit})` : ''}`
            : null,
        },
        {
          term: t.request,
          value: (
            <Link
              href={cleaningPaths.request(program.requestId)}
              aria-label={t.openRequest(program.number)}
              className="text-accent-ink inline-flex min-h-11 items-center font-semibold underline"
            >
              {t.openRequestShort}
            </Link>
          ),
        },
      ]}
    />
  );
}

/** Arrêt demandé, en attente d'une deuxième personne (partie 12). */
function PendingCancellation({ program, mine }: { program: Program; mine: boolean }) {
  const pending = program.pendingCancellation;
  if (!pending) return null;
  return (
    <section
      aria-labelledby="programme-arret"
      className="rounded-card border-warning bg-warning-soft grid gap-2 border p-4"
    >
      <h2 id="programme-arret" className="text-ink font-semibold">
        {t.pending.title}
      </h2>
      <p>{t.pending.text(formatDateTime(pending.requestedAt))}</p>
      <p className="text-ink-muted">{t.pending.reason(pending.reason)}</p>
      {mine ? <FormMessage tone="info">{t.pending.mine}</FormMessage> : null}
    </section>
  );
}

function ProgramView({ userId, ...props }: ProgramProps & { userId: string | null }) {
  const { program } = props;
  const [form, setForm] = useState<ProgramForm>(null);
  const [notice, setNotice] = useState<ReactNode>(null);
  const showForm = form !== null && !isClosedProgram(program) && program.status !== 'suspended';
  const close = (message?: ReactNode) => {
    setForm(null);
    setNotice(message ?? null);
  };
  const open = (next: ProgramForm) => {
    setNotice(null);
    setForm(next);
  };
  return (
    <div className="grid gap-4">
      <Header program={program} />
      <PendingCancellation program={program} mine={program.pendingCancellation?.requestedBy === userId} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel title={t.summary} id="programme-resume">
          <Summary program={program} />
        </Panel>
        <Panel title={t.actions.title} id="programme-decisions">
          <ProgramActions {...props} userId={userId} form={form} onForm={open} />
        </Panel>
      </div>
      <FormMessage tone="success">{notice}</FormMessage>
      {showForm && form === 'schedule' ? <ScheduleChangeForm {...props} onClose={close} /> : null}
      {showForm && form === 'amendment' ? <AmendmentForm {...props} onClose={close} /> : null}
    </div>
  );
}

function ProgramScreen({
  id,
  access,
  userId,
}: {
  id: string;
  access: CleaningAccess;
  userId: string | null;
}) {
  const program = useResource(useCallback(() => getProgram(id), [id]));
  /** Relecture de l'échéancier après chaque décision (séances suspendues, annulées, réaffectées). */
  const [round, setRound] = useState(0);
  const onChange = (next: Program) => {
    program.set(next);
    setRound((value) => value + 1);
  };
  return (
    <ResourceView resource={program} lines={10}>
      {(data) => (
        <div className="grid gap-4">
          <ProgramView program={data} onChange={onChange} access={access} userId={userId} />
          <ProgramSessions key={round} program={data} />
        </div>
      )}
    </ResourceView>
  );
}

/** Fiche d'un programme (`/nettoyage/programmes/[id]`), lue par le navigateur une fois la session reprise. */
export function ProgramDetail({ id }: { id: string }) {
  const access = useCleaningAccess();
  const userId = useSession()?.user.id ?? null;
  return (
    <div className="grid gap-4">
      <BackLink href={cleaningPaths.programs}>{t.back}</BackLink>
      {!access ? (
        <LoadingBlock lines={8} />
      ) : access['cleaning.program.read'] ? (
        <ProgramScreen id={id} access={access} userId={userId} />
      ) : (
        <Note>{cleaningTexts.common.forbidden}</Note>
      )}
    </div>
  );
}
