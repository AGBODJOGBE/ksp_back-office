'use client';

import { useCallback, useState } from 'react';
import { FormMessage, TextField } from '@/components/ui/field';
import { SelectField } from '@/components/ui/select-field';
import { useResource } from '@/lib/use-resource';
import { activeAgents, type CreateTeamBody, type UpdateTeamBody } from '@/features/cleaning/agents-api';
import type { Team } from '@/features/cleaning/agents-schemas';
import { agentName, agentStatus } from '@/features/cleaning/agents-texts';
import { teamsTexts } from '@/features/cleaning/teams-texts';
import { cleaningTexts } from '@/features/cleaning/texts';
import { CheckList } from './agent-parts';
import { type FieldErrors, FormFooter, LoadingBlock, useFormSubmit } from './parts';

const t = teamsTexts.form;
const c = cleaningTexts.common;
export const MAX_MEMBERS = 30;
const FIELDS = ['name', 'memberIds', 'leadAgentId'] as const;

interface Choice {
  id: string;
  label: string;
}

/** Membres proposés : agents actifs, puis membres actuels qui ne le sont plus (statut affiché). */
function memberChoices(agents: readonly { id: string; firstName: string; lastName: string }[], team?: Team) {
  const choices: Choice[] = agents.map((agent) => ({ id: agent.id, label: agentName(agent) }));
  for (const member of team?.members ?? []) {
    if (!choices.some((choice) => choice.id === member.agentId)) {
      choices.push({
        id: member.agentId,
        label: `${agentName(member)} ${t.inactiveMember(agentStatus(member.status).label)}`,
      });
    }
  }
  return choices.sort((a, b) => a.label.localeCompare(b.label, 'fr'));
}

const sameSet = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((item) => b.includes(item));

/**
 * Formulaire d'une équipe : nom, membres (agents actifs, 30 au plus) et chef d'équipe choisi parmi
 * eux (R-EQ-03). `onSubmit` reçoit le corps complet (création) et les seuls champs changés
 * (modification).
 */
export function TeamForm({
  team,
  submitLabel,
  onSubmit,
}: {
  team?: Team;
  submitLabel: string;
  onSubmit: (body: { full: CreateTeamBody; changes: UpdateTeamBody }) => Promise<string | void>;
}) {
  const agents = useResource(useCallback(() => activeAgents(), []));
  const [name, setName] = useState(team?.name ?? '');
  const [members, setMembers] = useState<string[]>(team?.members.map((member) => member.agentId) ?? []);
  const [lead, setLead] = useState(team?.leadAgentId ?? '');
  const form = useFormSubmit(FIELDS);

  if (agents.state.status === 'loading') return <LoadingBlock lines={5} />;
  const list = agents.state.status === 'ready' ? agents.state.data : [];
  const choices = memberChoices(list, team);
  const leadChoices = choices.filter((choice) => members.includes(choice.id));

  function check(): FieldErrors {
    const errors: FieldErrors = {};
    if (!name.trim()) errors.name = c.required;
    else if (name.trim().length > 100) errors.name = c.tooLong(100);
    if (!members.length) errors.memberIds = t.noMember;
    else if (members.length > MAX_MEMBERS) errors.memberIds = t.tooMany;
    if (!lead || !members.includes(lead)) errors.leadAgentId = t.noLead;
    return errors;
  }

  function body(): { full: CreateTeamBody; changes: UpdateTeamBody } {
    const full = { name: name.trim(), leadAgentId: lead, memberIds: members };
    const changes: UpdateTeamBody = {};
    if (!team) return { full, changes: full };
    if (full.name !== team.name) changes.name = full.name;
    if (lead !== team.leadAgentId) changes.leadAgentId = lead;
    if (
      !sameSet(
        members,
        team.members.map((member) => member.agentId),
      )
    )
      changes.memberIds = members;
    return { full, changes };
  }

  return (
    <form
      noValidate
      className="grid gap-5"
      onSubmit={(event) => void form.submit(event, check(), () => onSubmit(body()))}
    >
      {agents.state.status === 'error' ? <FormMessage>{t.agentsError}</FormMessage> : null}
      <TextField
        id="name"
        label={t.name}
        hint={t.nameHint}
        maxLength={100}
        value={name}
        error={form.errors.name}
        onChange={(event) => setName(event.target.value)}
        className="max-w-md"
      />
      {choices.length ? (
        <CheckList
          id="memberIds"
          legend={t.members}
          hint={t.membersHint}
          error={form.errors.memberIds}
          options={choices.map((choice) => ({ value: choice.id, label: choice.label }))}
          selected={members}
          onChange={(next) => {
            setMembers(next);
            if (lead && !next.includes(lead)) setLead('');
          }}
        />
      ) : (
        <FormMessage tone="info">{t.noAgents}</FormMessage>
      )}
      <SelectField
        id="leadAgentId"
        label={t.lead}
        hint={t.leadHint}
        value={lead}
        error={form.errors.leadAgentId}
        className="max-w-md"
        onChange={(event) => setLead(event.target.value)}
      >
        <option value="">{t.leadPlaceholder}</option>
        {leadChoices.map((choice) => (
          <option key={choice.id} value={choice.id}>
            {choice.label}
          </option>
        ))}
      </SelectField>
      <FormFooter pending={form.pending} message={form.message} success={form.success} label={submitLabel} />
    </form>
  );
}
