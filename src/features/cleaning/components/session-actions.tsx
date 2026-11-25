'use client';

import { useState } from 'react';
import { ConfirmAction } from '@/components/ui/confirm-action';
import { FormMessage, TextField } from '@/components/ui/field';
import { SelectField } from '@/components/ui/select-field';
import { beninInputToIso, isoToBeninInput } from '@/lib/format';
import { attempt } from '@/features/cleaning/errors';
import { parseInteger } from '@/features/cleaning/inputs';
import { cancelSession, rescheduleSession, resumeSession } from '@/features/cleaning/programs-api';
import type { CleaningSession, SessionStatus } from '@/features/cleaning/programs-schemas';
import { sessionActionTexts, sessionTexts } from '@/features/cleaning/session-texts';
import { Note, Panel } from './parts';
import { confirmLabels, ReasonField, reasonError, reasonOf, useKeyed } from './request-parts';
import { CompleteSession, ReportMissed } from './session-close';
import type { SessionProps } from './session-detail';

const t = sessionActionTexts;

/** Gestes possibles selon le statut (partie 15.2 ; clôture et absence pour l'équipe : R-EX-08). */
const ALLOWED: Record<'move' | 'cancel' | 'resume' | 'complete' | 'missed', readonly SessionStatus[]> = {
  move: ['to_assign', 'assigned', 'interrupted', 'suspended'],
  cancel: ['to_assign', 'assigned', 'interrupted', 'suspended'],
  resume: ['interrupted'],
  complete: ['assigned', 'in_progress', 'interrupted'],
  missed: ['assigned', 'in_progress'],
};

export const allowed = (session: CleaningSession, action: keyof typeof ALLOWED) =>
  ALLOWED[action].includes(session.status);

/** Déplacer une séance : nouveau début dans le futur, durée facultative, motif. */
function Move({ session, onDone }: { session: CleaningSession; onDone: (next: CleaningSession) => void }) {
  const keyed = useKeyed();
  const m = t.move;
  return (
    <ConfirmAction
      label={m.open}
      title={m.title}
      description={m.lead}
      confirmLabel={m.submit}
      labels={confirmLabels}
      onConfirm={async (data) => {
        const newStart = beninInputToIso(String(data.get('newStart') ?? ''));
        if (!newStart) return m.invalidStart;
        if (new Date(newStart).getTime() <= Date.now()) return m.past;
        const raw = String(data.get('durationMinutes') ?? '').trim();
        const minutes = raw ? parseInteger(raw) : undefined;
        if (minutes === null || (minutes !== undefined && (minutes < 15 || minutes > 1440)))
          return m.invalidDuration;
        const reason = reasonOf(data);
        const invalid = reasonError(reason);
        if (invalid) return invalid;
        return attempt(async () =>
          onDone(
            await keyed((key) =>
              rescheduleSession(
                session.id,
                { newStart, reason, ...(minutes === undefined ? {} : { durationMinutes: minutes }) },
                key,
              ),
            ),
          ),
        );
      }}
    >
      <TextField
        id={`seance-${session.id}-debut`}
        name="newStart"
        type="datetime-local"
        label={m.start}
        defaultValue={isoToBeninInput(session.scheduledStart)}
      />
      <TextField
        id={`seance-${session.id}-duree`}
        name="durationMinutes"
        inputMode="numeric"
        label={m.duration}
        hint={m.durationHint}
      />
      <ReasonField id={`seance-${session.id}-deplacement-motif`} />
    </ConfirmAction>
  );
}

function Cancel({ session, onDone }: { session: CleaningSession; onDone: (next: CleaningSession) => void }) {
  const keyed = useKeyed();
  const c = t.cancel;
  return (
    <ConfirmAction
      label={c.open}
      title={c.title}
      description={c.text}
      confirmLabel={c.confirm}
      labels={confirmLabels}
      danger
      onConfirm={async (data) => {
        const reason = reasonOf(data);
        const invalid = reasonError(reason);
        if (invalid) return invalid;
        const initiatedBy = data.get('initiatedBy') === 'customer_late' ? 'customer_late' : 'ksp';
        return attempt(async () =>
          onDone(await keyed((key) => cancelSession(session.id, { initiatedBy, reason }, key))),
        );
      }}
    >
      <SelectField
        id={`seance-${session.id}-origine`}
        name="initiatedBy"
        label={c.initiatedBy}
        defaultValue="ksp"
      >
        <option value="ksp">{c.initiators.ksp}</option>
        <option value="customer_late">{c.initiators.customer_late}</option>
      </SelectField>
      <ReasonField id={`seance-${session.id}-annulation-motif`} />
    </ConfirmAction>
  );
}

function Resume({ session, onDone }: { session: CleaningSession; onDone: (next: CleaningSession) => void }) {
  const keyed = useKeyed();
  const r = t.resume;
  return (
    <ConfirmAction
      label={r.open}
      title={r.title}
      description={r.text}
      confirmLabel={r.confirm}
      labels={confirmLabels}
      onConfirm={async (data) => {
        const reason = reasonOf(data);
        if (reason.length > 500) return reasonError(reason);
        return attempt(async () => onDone(await keyed((key) => resumeSession(session.id, reason, key))));
      }}
    >
      <ReasonField id={`seance-${session.id}-reprise-motif`} label={t.reasonOptional} required={false} />
    </ConfirmAction>
  );
}

/** Gestes de KSP sur une séance, selon son statut et les droits (affichage seulement). */
export function SessionActions({ session, onChange, access }: SessionProps) {
  const [done, setDone] = useState<string | null>(null);
  const canManage = access['cleaning.program.manage'];
  const onDone = (next: CleaningSession) => {
    onChange(next);
    setDone(t.done);
  };
  const any = (Object.keys(ALLOWED) as (keyof typeof ALLOWED)[]).some((action) => allowed(session, action));
  return (
    <Panel title={t.title} id="seance-gestes">
      {!canManage ? (
        <Note>{t.readOnly}</Note>
      ) : !any ? (
        <Note>{t.closed}</Note>
      ) : (
        <div className="flex flex-wrap gap-3">
          {allowed(session, 'move') ? <Move session={session} onDone={onDone} /> : null}
          {allowed(session, 'resume') ? <Resume session={session} onDone={onDone} /> : null}
          {allowed(session, 'complete') && session.agents.length ? (
            <CompleteSession session={session} onDone={onDone} />
          ) : null}
          {allowed(session, 'missed') && session.agents.length ? (
            <ReportMissed session={session} onDone={onDone} />
          ) : null}
          {allowed(session, 'cancel') ? <Cancel session={session} onDone={onDone} /> : null}
        </div>
      )}
      {canManage && (allowed(session, 'complete') || allowed(session, 'missed')) ? (
        <Note>{sessionTexts.mfaHint}</Note>
      ) : null}
      <FormMessage tone="success">{done}</FormMessage>
    </Panel>
  );
}
