'use client';

import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/field';
import type { AgentOption, Team } from '@/features/cleaning/agents-schemas';
import { assignTexts } from '@/features/cleaning/assignment-texts';
import { errorText } from '@/features/cleaning/errors';
import { type AssignmentBody, checkAssignment, createAssignments } from '@/features/cleaning/planning-api';
import type { AssignmentBatch, CheckReport, PlanningItem } from '@/features/cleaning/planning-schemas';
import { warningTexts } from '@/features/cleaning/planning-texts';
import { hasBlockingFailure, overridableFailures, targetOf } from '@/features/cleaning/planning-view';
import { ChecksReport } from './assignment-checks';
import {
  AgentBoxes,
  LeadSelect,
  type OverrideDraft,
  OverridesFieldset,
  TeamSelect,
} from './assignment-pickers';
import { useKeyed } from './request-parts';

const t = assignTexts;
const MAX_AGENTS = 30;

type Mode = 'agents' | 'team';
interface Draft {
  mode: Mode;
  agentIds: string[];
  teamId: string;
  leadAgentId: string;
  overrides: OverrideDraft;
}
type Errors = Partial<Record<'agents' | 'team' | 'lead' | 'overrides', string>>;

const EMPTY: Draft = { mode: 'agents', agentIds: [], teamId: '', leadAgentId: '', overrides: {} };

/** Corps envoyé au contrôle puis à l'affectation : agents (et chef) ou équipe, dérogations cochées. */
function bodyOf(item: PlanningItem, draft: Draft): AssignmentBody {
  const body: AssignmentBody = { targets: [targetOf(item)] };
  if (draft.mode === 'agents') {
    body.agentIds = draft.agentIds;
    if (draft.leadAgentId) body.leadAgentId = draft.leadAgentId;
  } else body.teamId = draft.teamId;
  const overrides = Object.entries(draft.overrides)
    .filter(([, value]) => value?.on)
    .map(([check, value]) => ({ check, reason: value?.reason.trim() ?? '' }));
  if (overrides.length) body.overrides = overrides as AssignmentBody['overrides'];
  return body;
}

/** Contrôles locaux : au moins un agent (30 au plus) ou une équipe, chef au-delà d'un agent, motifs. */
function localErrors(draft: Draft): Errors {
  const errors: Errors = {};
  if (draft.mode === 'agents') {
    if (!draft.agentIds.length) errors.agents = t.needAgent;
    else if (draft.agentIds.length > MAX_AGENTS) errors.agents = t.tooMany;
    if (draft.agentIds.length > 1 && !draft.agentIds.includes(draft.leadAgentId)) errors.lead = t.needLead;
  } else if (!draft.teamId) errors.team = t.needTeam;
  if (Object.values(draft.overrides).some((value) => value?.on && !value.reason.trim())) {
    errors.overrides = t.reasonRequired;
  }
  return errors;
}

/**
 * Affecter une intervention : choisir des agents (et le chef) ou une équipe, « Contrôler » (rien n'est
 * enregistré) affiche les alertes, puis « Confirmer » enregistre avec une clé d'idempotence. Toute
 * modification de la sélection impose un nouveau contrôle. Une alerte contournable (zone,
 * disponibilité, charge, taille d'équipe) peut être forcée avec un motif, puis recontrôlée.
 */
export function AssignForm({
  item,
  agents,
  teams,
  names,
  onDone,
}: {
  item: PlanningItem;
  agents: readonly AgentOption[];
  teams: readonly Team[];
  names: ReadonlyMap<string, string>;
  onDone: (batch: AssignmentBatch) => void;
}) {
  const prefix = `affecter-${item.id}`;
  const keyed = useKeyed();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [checked, setChecked] = useState<{ key: string; report: CheckReport } | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState<AssignmentBatch | null>(null);

  const body = bodyOf(item, draft);
  const key = JSON.stringify(body);
  const report = checked?.key === key ? checked.report : null;
  const stale = checked !== null && !report;
  const overridable = checked ? overridableFailures(checked.report.checks) : [];

  const change = (next: Partial<Draft>) => {
    setDraft((current) => ({ ...current, ...next }));
    setErrors({});
    setDone(null);
  };

  async function run(action: () => Promise<void>) {
    if (pending) return;
    setPending(true);
    setMessage(null);
    try {
      await action();
    } catch (error) {
      setMessage(errorText(error));
    } finally {
      setPending(false);
    }
  }

  function check(event: FormEvent) {
    event.preventDefault();
    const local = localErrors(draft);
    setErrors(local);
    if (Object.keys(local).length) return;
    void run(async () => setChecked({ key, report: await checkAssignment(body) }));
  }

  const confirm = () =>
    run(async () => {
      const batch = await keyed((idempotencyKey) => createAssignments(body, idempotencyKey));
      setDone(batch);
      setDraft(EMPTY);
      setChecked(null);
      onDone(batch);
    });

  const leadOptions = draft.agentIds.map((id) => ({ value: id, label: names.get(id) ?? t.someone(id) }));

  return (
    <form noValidate onSubmit={check} className="grid gap-4" aria-label={t.title}>
      <fieldset className="flex flex-wrap gap-2">
        <legend className="text-ink mb-1 font-semibold">{t.mode}</legend>
        {(['agents', 'team'] as const).map((mode) => (
          <Button
            key={mode}
            variant={draft.mode === mode ? 'action' : 'secondary'}
            aria-pressed={draft.mode === mode}
            onClick={() => change({ mode, overrides: {} })}
          >
            {t.modes[mode]}
          </Button>
        ))}
      </fieldset>
      {draft.mode === 'agents' ? (
        <>
          <AgentBoxes
            idPrefix={prefix}
            agents={agents}
            communeKey={item.communeKey}
            teamSize={item.teamSize}
            selected={draft.agentIds}
            error={errors.agents}
            onToggle={(id, on) => {
              const agentIds = on ? [...draft.agentIds, id] : draft.agentIds.filter((value) => value !== id);
              change({
                agentIds,
                leadAgentId: agentIds.includes(draft.leadAgentId) ? draft.leadAgentId : '',
              });
            }}
          />
          {draft.agentIds.length > 1 ? (
            <LeadSelect
              id={`${prefix}-chef`}
              options={leadOptions}
              value={draft.leadAgentId}
              error={errors.lead}
              onChange={(leadAgentId) => change({ leadAgentId })}
            />
          ) : null}
        </>
      ) : (
        <TeamSelect
          id={`${prefix}-equipe`}
          teams={teams}
          value={draft.teamId}
          error={errors.team}
          onChange={(teamId) => change({ teamId })}
        />
      )}
      <OverridesFieldset
        idPrefix={prefix}
        checks={overridable}
        value={draft.overrides}
        error={errors.overrides}
        onChange={(overrides) => change({ overrides })}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          variant={report?.passed ? 'secondary' : 'action'}
          aria-busy={pending || undefined}
          disabled={pending}
        >
          {pending ? t.checking : t.check}
        </Button>
        {report?.passed ? (
          <Button variant="action" disabled={pending} onClick={() => void confirm()}>
            {body.overrides?.length ? t.confirmAnyway : t.confirm}
          </Button>
        ) : null}
      </div>
      <div aria-live="polite" className="grid gap-3">
        {stale ? <FormMessage tone="info">{t.changed}</FormMessage> : null}
        {report ? (
          <FormMessage tone={report.passed ? 'success' : 'error'}>
            {report.passed ? t.passed : hasBlockingFailure(report.checks) ? t.blocking : t.failed}
          </FormMessage>
        ) : null}
        <FormMessage>{message}</FormMessage>
        {done ? <BatchSummary batch={done} names={names} /> : null}
      </div>
      {report ? <ChecksReport checks={report.checks} names={names} /> : null}
    </form>
  );
}

/** Résultat d'une affectation : nombre enregistré, alertes d'équipe, cibles écartées. */
export function BatchSummary({
  batch,
  names,
}: {
  batch: AssignmentBatch;
  names: ReadonlyMap<string, string>;
}) {
  return (
    <div className="grid gap-2">
      <FormMessage tone="success">{t.done(batch.assignments.length)}</FormMessage>
      {batch.warnings.map((warning) => (
        <FormMessage key={warning} tone="info">
          {warningTexts[warning]}
        </FormMessage>
      ))}
      {batch.skipped.length ? (
        <ChecksReport checks={batch.skipped} names={names} title={t.skipped(batch.skipped.length)} />
      ) : null}
    </div>
  );
}
