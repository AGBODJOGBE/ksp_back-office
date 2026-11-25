'use client';

import { SelectField, TextAreaField } from '@/components/ui/select-field';
import type { AgentOption, Team } from '@/features/cleaning/agents-schemas';
import { assignTexts } from '@/features/cleaning/assignment-texts';
import type { OverridableCheck } from '@/features/cleaning/planning-schemas';
import { checkNames } from '@/features/cleaning/planning-texts';
import { MAX_REASON } from './request-parts';
import { Note } from './parts';

const t = assignTexts;

/** Agents actifs à cocher ; ceux qui travaillent dans la commune de l'intervention d'abord. */
export function AgentBoxes({
  idPrefix,
  agents,
  communeKey,
  teamSize,
  selected,
  onToggle,
  error,
}: {
  idPrefix: string;
  agents: readonly AgentOption[];
  communeKey: string;
  teamSize: number;
  selected: readonly string[];
  onToggle: (agentId: string, checked: boolean) => void;
  error?: string | null;
}) {
  if (!agents.length) return <Note>{t.noAgents}</Note>;
  const sorted = [...agents].sort(
    (a, b) => Number(b.zoneKeys.includes(communeKey)) - Number(a.zoneKeys.includes(communeKey)),
  );
  const errorId = `${idPrefix}-agents-erreur`;
  return (
    <fieldset className="grid gap-1" aria-describedby={error ? errorId : undefined}>
      <legend className="text-ink font-semibold">{t.agents}</legend>
      <p className="text-small text-ink-muted">{t.agentsHint(teamSize)}</p>
      <div className="border-line rounded-control grid max-h-64 gap-0 overflow-y-auto border p-2">
        {sorted.map((agent) => (
          <label key={agent.id} className="flex min-h-11 items-center gap-3">
            <input
              type="checkbox"
              value={agent.id}
              checked={selected.includes(agent.id)}
              onChange={(event) => onToggle(agent.id, event.target.checked)}
              className="size-5"
            />
            <span className="text-ink">
              {agent.firstName} {agent.lastName}
            </span>
          </label>
        ))}
      </div>
      {error ? (
        <p id={errorId} className="text-small text-danger font-semibold">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

/** Équipe active à affecter (ses membres actifs et disponibles, R-EQ-02). */
export function TeamSelect({
  id,
  teams,
  value,
  onChange,
  error,
}: {
  id: string;
  teams: readonly Team[];
  value: string;
  onChange: (teamId: string) => void;
  error?: string | null;
}) {
  if (!teams.length) return <Note>{t.noTeams}</Note>;
  return (
    <SelectField
      id={id}
      label={t.team}
      hint={t.teamHint}
      value={value}
      error={error}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">{t.chooseTeam}</option>
      {teams.map((team) => (
        <option key={team.id} value={team.id}>
          {team.name} ({team.members.length})
        </option>
      ))}
    </SelectField>
  );
}

/** Chef d'équipe parmi les agents choisis. */
export function LeadSelect({
  id,
  options,
  value,
  onChange,
  error,
}: {
  id: string;
  options: readonly { value: string; label: string }[];
  value: string;
  onChange: (agentId: string) => void;
  error?: string | null;
}) {
  return (
    <SelectField
      id={id}
      label={t.leadAgent}
      hint={t.leadHint}
      value={value}
      error={error}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">{t.chooseLead}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </SelectField>
  );
}

export type OverrideDraft = Partial<Record<OverridableCheck, { on: boolean; reason: string }>>;

/** Dérogations : une case et un motif par contrôle contournable en échec (motif obligatoire). */
export function OverridesFieldset({
  idPrefix,
  checks,
  value,
  onChange,
  error,
}: {
  idPrefix: string;
  checks: readonly OverridableCheck[];
  value: OverrideDraft;
  onChange: (next: OverrideDraft) => void;
  error?: string | null;
}) {
  if (!checks.length) return null;
  return (
    <fieldset className="border-line rounded-control grid gap-3 border p-3">
      <legend className="text-ink px-1 font-semibold">{t.overridesTitle}</legend>
      <p className="text-small text-ink-muted">{t.overridesLead}</p>
      {checks.map((check) => {
        const draft = value[check] ?? { on: false, reason: '' };
        const name = checkNames[check];
        return (
          <div key={check} className="grid gap-2">
            <label className="flex min-h-11 items-center gap-3">
              <input
                type="checkbox"
                className="size-5"
                checked={draft.on}
                onChange={(event) => onChange({ ...value, [check]: { ...draft, on: event.target.checked } })}
              />
              <span className="text-ink">{t.override(name)}</span>
            </label>
            {draft.on ? (
              <TextAreaField
                id={`${idPrefix}-motif-${check}`}
                label={t.overrideReason(name)}
                maxLength={MAX_REASON}
                required
                value={draft.reason}
                error={draft.reason.trim() ? null : error}
                onChange={(event) =>
                  onChange({ ...value, [check]: { ...draft, reason: event.target.value } })
                }
              />
            ) : null}
          </div>
        );
      })}
    </fieldset>
  );
}
