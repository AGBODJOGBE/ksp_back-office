'use client';

import { ConfirmAction } from '@/components/ui/confirm-action';
import { TextField } from '@/components/ui/field';
import { SelectField } from '@/components/ui/select-field';
import { beninInputToIso, isoToBeninInput } from '@/lib/format';
import { attempt } from '@/features/cleaning/errors';
import { completeSession, reportSessionMissed } from '@/features/cleaning/programs-api';
import type { CleaningSession } from '@/features/cleaning/programs-schemas';
import { sessionActionTexts } from '@/features/cleaning/session-texts';
import { confirmLabels, ReasonField, reasonError, reasonOf, useKeyed } from './request-parts';

/*
 * Gestes du back-office à la place de l'équipe (R-EX-08) : clôturer la séance, ou enregistrer l'absence
 * du client. Agents présents choisis parmi les affectés ; motif obligatoire ; action tracée.
 */

const t = sessionActionTexts;

type Done = (next: CleaningSession) => void;

/** Cases « agents présents » (lues dans le `FormData`, `presentAgentIds`), toutes cochées au départ. */
function PresentAgents({
  session,
  legend,
  kind,
}: {
  session: CleaningSession;
  legend: string;
  kind: string;
}) {
  return (
    <fieldset className="grid gap-1">
      <legend className="text-ink mb-1 font-semibold">{legend}</legend>
      {session.agents.map((agent) => {
        const id = `seance-${session.id}-${kind}-${agent.agentId}`;
        return (
          <div key={agent.agentId} className="flex min-h-11 items-center gap-3">
            <input
              id={id}
              type="checkbox"
              name="presentAgentIds"
              value={agent.agentId}
              defaultChecked
              className="accent-action size-5 shrink-0"
            />
            <label htmlFor={id} className="text-ink">
              {agent.firstName} {agent.lastName}
            </label>
          </div>
        );
      })}
    </fieldset>
  );
}

const presentOf = (data: FormData) => data.getAll('presentAgentIds').map(String).filter(Boolean);
const whenOf = (data: FormData, name: string) => beninInputToIso(String(data.get(name) ?? ''));

/** Clôturer pour l'équipe : début et fin réels (fin jamais dans le futur), agents présents, motif. */
export function CompleteSession({ session, onDone }: { session: CleaningSession; onDone: Done }) {
  const keyed = useKeyed();
  const c = t.complete;
  const now = isoToBeninInput(new Date().toISOString());
  return (
    <ConfirmAction
      label={c.open}
      title={c.title}
      description={c.lead}
      confirmLabel={c.submit}
      labels={confirmLabels}
      onConfirm={async (data) => {
        const startedAt = whenOf(data, 'startedAt');
        const completedAt = whenOf(data, 'completedAt');
        if (!startedAt || !completedAt) return c.invalidWhen;
        if (new Date(completedAt).getTime() > Date.now()) return c.future;
        if (new Date(completedAt).getTime() <= new Date(startedAt).getTime()) return c.order;
        const presentAgentIds = presentOf(data);
        if (!presentAgentIds.length) return c.noPresent;
        const reason = reasonOf(data);
        const invalid = reasonError(reason);
        if (invalid) return invalid;
        return attempt(async () =>
          onDone(
            await keyed((key) =>
              completeSession(session.id, { reason, startedAt, completedAt, presentAgentIds }, key),
            ),
          ),
        );
      }}
    >
      <TextField
        id={`seance-${session.id}-debut-reel`}
        name="startedAt"
        type="datetime-local"
        label={c.startedAt}
        defaultValue={isoToBeninInput(session.startedAt ?? session.scheduledStart)}
      />
      <TextField
        id={`seance-${session.id}-fin-reelle`}
        name="completedAt"
        type="datetime-local"
        label={c.completedAt}
        max={now}
        defaultValue={now}
      />
      <PresentAgents session={session} legend={c.present} kind="cloture-present" />
      <ReasonField id={`seance-${session.id}-cloture-motif`} />
    </ConfirmAction>
  );
}

/** Client absent ou accès impossible : cause, heure du constat, agents présents, motif. */
export function ReportMissed({ session, onDone }: { session: CleaningSession; onDone: Done }) {
  const keyed = useKeyed();
  const m = t.missed;
  return (
    <ConfirmAction
      label={m.open}
      title={m.title}
      description={m.lead}
      confirmLabel={m.submit}
      labels={confirmLabels}
      onConfirm={async (data) => {
        const missedAt = whenOf(data, 'missedAt');
        if (!missedAt) return m.invalidWhen;
        const presentAgentIds = presentOf(data);
        if (!presentAgentIds.length) return m.noPresent;
        const reason = reasonOf(data);
        const invalid = reasonError(reason);
        if (invalid) return invalid;
        const cause = data.get('cause') === 'access_impossible' ? 'access_impossible' : 'customer_absent';
        return attempt(async () =>
          onDone(
            await keyed((key) =>
              reportSessionMissed(session.id, { reason, cause, missedAt, presentAgentIds }, key),
            ),
          ),
        );
      }}
    >
      <SelectField
        id={`seance-${session.id}-cause`}
        name="cause"
        label={m.cause}
        defaultValue="customer_absent"
      >
        <option value="customer_absent">{m.causes.customer_absent}</option>
        <option value="access_impossible">{m.causes.access_impossible}</option>
      </SelectField>
      <TextField
        id={`seance-${session.id}-constat`}
        name="missedAt"
        type="datetime-local"
        label={m.missedAt}
        defaultValue={isoToBeninInput(new Date().toISOString())}
      />
      <PresentAgents session={session} legend={m.present} kind="absence-present" />
      <ReasonField id={`seance-${session.id}-absence-motif`} />
    </ConfirmAction>
  );
}
