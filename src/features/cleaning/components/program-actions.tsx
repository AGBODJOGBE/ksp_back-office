'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmAction } from '@/components/ui/confirm-action';
import { FormMessage } from '@/components/ui/field';
import { formatDateTime } from '@/lib/format';
import { attempt } from '@/features/cleaning/errors';
import { cleaningPaths } from '@/features/cleaning/paths';
import { programChangeTexts, programDetailTexts } from '@/features/cleaning/program-detail-texts';
import {
  approveProgramCancellation,
  requestProgramCancellation,
  resumeProgram,
  suspendProgram,
} from '@/features/cleaning/programs-api';
import type { CatchUp, Program } from '@/features/cleaning/programs-schemas';
import type { ProgramProps } from './program-detail';
import { confirmLabels, ReasonField, reasonError, reasonOf, useKeyed } from './request-parts';
import { Note } from './parts';

const t = programDetailTexts;
const ch = programChangeTexts;

export type ProgramForm = 'schedule' | 'amendment' | null;

export const isClosedProgram = (program: Program) =>
  program.status === 'completed' || program.status === 'cancelled';

/** Séances à rattraper proposées par le serveur à la reprise (R-SU-03), à ouvrir une par une. */
function CatchUpList({ program, items }: { program: Program; items: readonly CatchUp[] }) {
  if (!items.length) return null;
  return (
    <section aria-labelledby="programme-rattrapage" className="grid gap-2">
      <h3 id="programme-rattrapage" className="text-ink font-semibold">
        {t.catchUp.title}
      </h3>
      <p className="text-small text-ink-muted">{t.catchUp.text}</p>
      <ul className="grid gap-1">
        {items.map((item) => (
          <li key={item.sessionId} className="flex flex-wrap items-center gap-2">
            <span>
              {t.catchUp.item(
                item.rank,
                formatDateTime(item.previousStart),
                item.suggestedStart ? formatDateTime(item.suggestedStart) : null,
              )}
            </span>
            <Link
              href={cleaningPaths.session(program.id, item.sessionId)}
              className="text-accent-ink inline-flex min-h-11 items-center font-semibold underline"
            >
              {t.catchUp.open(item.rank)}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Décisions sur un programme : changer l'horaire, préparer un avenant, suspendre ou lever la suspension
 * de KSP, demander l'arrêt puis le valider (deuxième personne). Affichage selon le statut et les
 * droits ; la gateway reste seule juge.
 */
export function ProgramActions({
  program,
  onChange,
  access,
  userId,
  form,
  onForm,
}: ProgramProps & { userId: string | null; form: ProgramForm; onForm: (form: ProgramForm) => void }) {
  /** Une clé par décision : un nouvel essai d'une décision ne réutilise jamais la clé d'une autre. */
  const keys = { suspend: useKeyed(), resume: useKeyed(), cancel: useKeyed(), approve: useKeyed() };
  const [done, setDone] = useState<string | null>(null);
  const [catchUp, setCatchUp] = useState<CatchUp[]>([]);
  const canManage = access['cleaning.program.manage'];
  const canQuote = access['cleaning.quote.manage'];

  if (!canManage && !canQuote) return <Note>{t.actions.readOnly}</Note>;
  if (isClosedProgram(program)) {
    return (
      <div className="grid gap-4">
        <FormMessage tone="success">{done}</FormMessage>
        <Note>{t.actions.closed}</Note>
      </div>
    );
  }

  const suspended = program.status === 'suspended';
  const kspSuspended = program.suspensionCauses.some((cause) => cause.cause === 'ksp_decision');
  const pending = program.pendingCancellation;
  const mine = pending?.requestedBy === userId;
  const apply = (next: Program, message: string) => {
    onChange(next);
    setDone(message);
  };
  const toggle = (next: Exclude<ProgramForm, null>) => {
    setDone(null);
    onForm(form === next ? null : next);
  };

  return (
    <div className="grid gap-4">
      {suspended ? <Note>{ch.schedule.suspended}</Note> : null}
      <div className="flex flex-wrap gap-3">
        {canManage && !suspended ? (
          <Button variant="secondary" aria-expanded={form === 'schedule'} onClick={() => toggle('schedule')}>
            {ch.schedule.open}
          </Button>
        ) : null}
        {canQuote && !suspended ? (
          <Button
            variant="secondary"
            aria-expanded={form === 'amendment'}
            onClick={() => toggle('amendment')}
          >
            {ch.amendment.open}
          </Button>
        ) : null}
        {canManage && !kspSuspended ? (
          <ConfirmAction
            label={t.suspend.open}
            title={t.suspend.title}
            description={t.suspend.text}
            confirmLabel={t.suspend.confirm}
            labels={confirmLabels}
            danger
            onConfirm={async (data) => {
              const reason = reasonOf(data);
              const invalid = reasonError(reason);
              if (invalid) return invalid;
              return attempt(async () =>
                apply(await keys.suspend((key) => suspendProgram(program.id, reason, key)), t.suspend.done),
              );
            }}
          >
            <ReasonField id="programme-suspension-motif" />
          </ConfirmAction>
        ) : null}
        {canManage && kspSuspended ? (
          <ConfirmAction
            label={t.resume.open}
            title={t.resume.title}
            description={t.resume.text}
            confirmLabel={t.resume.confirm}
            labels={confirmLabels}
            onConfirm={async (data) => {
              const reason = reasonOf(data);
              if (reason.length > 500) return reasonError(reason);
              return attempt(async () => {
                const result = await keys.resume((key) => resumeProgram(program.id, reason, key));
                setCatchUp(result.catchUp);
                apply(
                  result.program,
                  result.program.status === 'suspended' ? t.resume.stillSuspended : t.resume.done,
                );
              });
            }}
          >
            <ReasonField id="programme-reprise-motif" label={t.resume.reason} required={false} />
          </ConfirmAction>
        ) : null}
        {canManage && !pending ? (
          <ConfirmAction
            label={t.cancel.open}
            title={t.cancel.title}
            description={t.cancel.text}
            confirmLabel={t.cancel.confirm}
            labels={confirmLabels}
            danger
            onConfirm={async (data) => {
              const reason = reasonOf(data);
              const invalid = reasonError(reason);
              if (invalid) return invalid;
              return attempt(async () =>
                apply(
                  await keys.cancel((key) => requestProgramCancellation(program.id, reason, key)),
                  t.cancel.done,
                ),
              );
            }}
          >
            <ReasonField id="programme-arret-motif" />
          </ConfirmAction>
        ) : null}
        {canManage && pending && !mine ? (
          <ConfirmAction
            label={t.approve.open}
            title={t.approve.title}
            description={
              <>
                {t.approve.text} {t.pending.reason(pending.reason)}
              </>
            }
            confirmLabel={t.approve.confirm}
            labels={confirmLabels}
            danger
            onConfirm={() =>
              attempt(async () =>
                apply(
                  await keys.approve((key) => approveProgramCancellation(program.id, key)),
                  t.approve.done,
                ),
              )
            }
          />
        ) : null}
      </div>
      <FormMessage tone="success">{done}</FormMessage>
      <CatchUpList program={program} items={catchUp} />
    </div>
  );
}
