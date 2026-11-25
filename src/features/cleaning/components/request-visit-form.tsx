'use client';

import { useCallback, useState } from 'react';
import { TextField } from '@/components/ui/field';
import { SelectField, TextAreaField } from '@/components/ui/select-field';
import { beninInputToIso, formatSlot, isoToBeninInput } from '@/lib/format';
import { useResource } from '@/lib/use-resource';
import { loadErrorText } from '@/features/cleaning/errors';
import { parseInteger } from '@/features/cleaning/inputs';
import { activeAgents } from '@/features/cleaning/agents-api';
import type { AgentOption } from '@/features/cleaning/agents-schemas';
import { scheduleVisit, type UpdateVisitBody, updateVisit } from '@/features/cleaning/requests-api';
import type { Visit } from '@/features/cleaning/requests-schemas';
import { visitTexts } from '@/features/cleaning/request-work-texts';
import { cleaningTexts } from '@/features/cleaning/texts';
import { CheckField } from './editors';
import { MAX_REASON, type StepProps, useKeyed } from './request-parts';
import { type FieldErrors, FormFooter, Note, useFormSubmit } from './parts';

const t = visitTexts.schedule;
const c = cleaningTexts.common;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FIELDS = ['scheduledAt', 'durationMinutes', 'agentIds', 'leadAgentId', 'reason'] as const;

/** Agents actifs, ceux qui travaillent dans la commune du lieu en premier. */
function sortAgents(agents: AgentOption[], communeKey: string) {
  const inZone = (agent: AgentOption) => agent.zoneKeys.includes(communeKey);
  return [...agents].sort((a, b) => Number(inZone(b)) - Number(inZone(a)));
}

/** Choix de l'agent : liste des agents actifs si le rôle la lit, sinon identifiant saisi (à valider). */
function AgentField({
  communeKey,
  canList,
  value,
  error,
  disabled,
  onChange,
}: {
  communeKey: string;
  canList: boolean;
  value: string;
  error?: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const agents = useResource(
    useCallback(() => (canList ? activeAgents() : Promise.resolve(null)), [canList]),
  );
  const { state } = agents;
  if (state.status === 'ready' && state.data) {
    return (
      <SelectField
        id="visite-agent"
        label={t.agent}
        hint={t.agentHint}
        value={value}
        error={error}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{t.chooseAgent}</option>
        {sortAgents(state.data, communeKey).map((agent) => (
          <option key={agent.id} value={agent.id}>
            {agent.firstName} {agent.lastName}
            {agent.zoneKeys.includes(communeKey) ? '' : ` (${t.outOfZone})`}
          </option>
        ))}
      </SelectField>
    );
  }
  if (state.status === 'loading' && canList) return <Note>{c.loading}</Note>;
  return (
    <div className="grid gap-2">
      {state.status === 'error' ? <Note>{loadErrorText(state.error)}</Note> : null}
      <TextField
        id="visite-agent"
        label={t.agentId}
        hint={t.agentIdHint}
        value={value}
        error={error}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value.trim())}
      />
    </div>
  );
}

/** Planifier la visite du dossier, ou déplacer une visite / changer son agent (`visit`). */
export function VisitForm({
  request,
  access,
  visit,
  onDone,
}: StepProps & { visit?: Visit; onDone: () => void }) {
  const keyed = useKeyed();
  const form = useFormSubmit(FIELDS);
  const lead = visit?.agents.find((agent) => agent.isLead) ?? visit?.agents[0];
  const firstSlot = request.visitSlots[0]?.start;
  const initial = visit ? isoToBeninInput(visit.scheduledAt) : firstSlot ? isoToBeninInput(firstSlot) : '';
  const [when, setWhen] = useState(initial);
  const [duration, setDuration] = useState(visit ? String(visit.durationMinutes) : '');
  const [agentId, setAgentId] = useState(lead?.agentId ?? '');
  const [autoAssign, setAutoAssign] = useState(false);
  const [reason, setReason] = useState('');
  const prefix = visit ? `deplacer-${visit.id}` : 'planifier';

  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    if (!beninInputToIso(when)) errors.scheduledAt = t.invalidWhen;
    const minutes = duration.trim() ? parseInteger(duration) : undefined;
    if (minutes === null || (minutes !== undefined && (minutes < 15 || minutes > 480))) {
      errors.durationMinutes = t.durationRange;
    }
    if (!autoAssign && !agentId) errors.agentIds = t.chooseOne;
    else if (!autoAssign && !UUID.test(agentId)) errors.agentIds = t.invalidId;
    if (reason.length > MAX_REASON) errors.reason = c.tooLong(MAX_REASON);
    return errors;
  }

  async function send() {
    const scheduledAt = beninInputToIso(when) as string;
    const durationMinutes = duration.trim() ? (parseInteger(duration) as number) : undefined;
    if (!visit) {
      await keyed((key) =>
        scheduleVisit(
          {
            requestId: request.id,
            scheduledAt,
            durationMinutes,
            agentIds: autoAssign ? [] : [agentId],
            leadAgentId: autoAssign ? undefined : agentId,
            autoAssign: autoAssign || undefined,
          },
          key,
        ),
      );
      onDone();
      return;
    }
    const body: UpdateVisitBody = {};
    if (scheduledAt !== new Date(visit.scheduledAt).toISOString()) body.scheduledAt = scheduledAt;
    if (durationMinutes !== undefined && durationMinutes !== visit.durationMinutes)
      body.durationMinutes = durationMinutes;
    if (agentId !== (lead?.agentId ?? '')) {
      body.agentIds = [agentId];
      body.leadAgentId = agentId;
    }
    if (!Object.keys(body).length) return t.nothing;
    if (reason.trim()) body.reason = reason.trim();
    await keyed((key) => updateVisit(visit.id, body, key));
    onDone();
  }

  return (
    <form
      noValidate
      onSubmit={(event) => void form.submit(event, validate(), send)}
      className="rounded-control bg-surface-muted grid gap-4 p-3 sm:p-4"
      aria-label={visit ? t.moveTitle : t.title}
    >
      <h3 className="text-ink font-semibold">{visit ? t.moveTitle : t.title}</h3>
      {request.visitSlots.length ? (
        <div className="grid gap-1">
          <p className="text-small text-ink-muted font-semibold">{t.slots}</p>
          <ul className="text-small text-ink grid gap-0.5">
            {request.visitSlots.map((slot) => (
              <li key={slot.start}>{formatSlot(slot)}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id={`${prefix}-quand`}
          type="datetime-local"
          label={t.when}
          value={when}
          error={form.errors.scheduledAt}
          onChange={(event) => setWhen(event.target.value)}
        />
        <TextField
          id={`${prefix}-duree`}
          inputMode="numeric"
          label={t.duration}
          hint={t.durationHint}
          value={duration}
          error={form.errors.durationMinutes}
          onChange={(event) => setDuration(event.target.value)}
        />
      </div>
      {visit ? null : (
        <CheckField id="planifier-auto" label={t.autoAssign} checked={autoAssign} onChange={setAutoAssign} />
      )}
      <AgentField
        communeKey={request.place.communeKey}
        canList={access['cleaning.planning.manage']}
        value={agentId}
        error={form.errors.agentIds ?? form.errors.leadAgentId}
        disabled={autoAssign}
        onChange={setAgentId}
      />
      {visit ? (
        <TextAreaField
          id={`${prefix}-motif`}
          label={t.reason}
          maxLength={MAX_REASON}
          value={reason}
          error={form.errors.reason}
          onChange={(event) => setReason(event.target.value)}
        />
      ) : null}
      <FormFooter
        pending={form.pending}
        message={form.message}
        success={form.success}
        label={visit ? t.submitMove : t.submit}
      />
    </form>
  );
}
