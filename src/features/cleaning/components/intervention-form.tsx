'use client';

import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormMessage, TextField } from '@/components/ui/field';
import { SelectField } from '@/components/ui/select-field';
import { ApiError } from '@/lib/api';
import { beninInputToIso, isoToBeninInput } from '@/lib/format';
import { useResource } from '@/lib/use-resource';
import { listAgents, listTeams, scheduleIntervention } from '@/features/cleaning/api';
import { errorText } from '@/features/cleaning/errors';
import { missionTexts } from '@/features/cleaning/mission-texts';
import type { Mission } from '@/features/cleaning/schemas';
import { cleaningTexts } from '@/features/cleaning/texts';
import { LoadError, LoadingBlock, Note } from './parts';

const t = missionTexts.schedule;
const common = cleaningTexts.common;

async function loadChoices() {
  const [agents, teams] = await Promise.all([listAgents(), listTeams()]);
  return { agents: agents.filter((agent) => agent.active), teams };
}

/**
 * Planification d'un passage (UC-CL-09) : début, durée, agents choisis un à un et/ou une équipe. La
 * gateway refuse un agent déjà pris (`CLEANING_TEAM_UNAVAILABLE`) : ses noms sont alors affichés.
 */
export function InterventionForm({
  mission,
  onDone,
  onCancel,
}: {
  mission: Mission;
  onDone: (mission: Mission) => void;
  onCancel: () => void;
}) {
  const choices = useResource(loadChoices);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (choices.state.status === 'loading') return <LoadingBlock lines={3} />;
  if (choices.state.status === 'error')
    return <LoadError error={choices.state.error} onRetry={choices.reload} />;
  const { agents, teams } = choices.state.data;
  const nameOf = (id: string) => agents.find((agent) => agent.agentId === id)?.displayName ?? id;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    const scheduledStart = beninInputToIso(String(data.get('start') ?? ''));
    const duration = String(data.get('duration') ?? '').trim();
    const agentIds = data.getAll('agents').map(String);
    const teamId = String(data.get('team') ?? '');
    if (!scheduledStart) return setError(common.invalidDate);
    if (!/^\d+$/.test(duration)) return setError(common.invalidNumber);
    setPending(true);
    setError(null);
    try {
      onDone(
        await scheduleIntervention(mission.id, {
          scheduledStart,
          durationMinutes: Number(duration),
          ...(agentIds.length ? { agentIds } : {}),
          ...(teamId ? { teamId } : {}),
        }),
      );
    } catch (caught) {
      const busy = caught instanceof ApiError ? caught.details.agentIds : undefined;
      setError(
        Array.isArray(busy) && busy.length
          ? `${errorText(caught)} ${t.unavailable(busy.map((id) => nameOf(String(id))).join(', '))}`
          : errorText(caught),
      );
      setPending(false);
    }
  }

  const slot = mission.chosenSlot;
  const minutes = Math.round((Date.parse(slot.end) - Date.parse(slot.start)) / 60_000);
  return (
    <form
      noValidate
      onSubmit={submit}
      aria-labelledby="passage-titre"
      className="bg-surface-muted rounded-card -mx-2 grid gap-5 p-3 sm:mx-0 sm:p-6"
    >
      <div>
        <h3 id="passage-titre" className="font-display text-h3 text-ink font-semibold">
          {t.title}
        </h3>
        <p className="text-small text-ink-muted mt-1">{t.text}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="passage-debut"
          name="start"
          type="datetime-local"
          label={t.when}
          hint={common.beninTime}
          defaultValue={isoToBeninInput(slot.start)}
          required
        />
        <TextField
          id="passage-duree"
          name="duration"
          label={t.duration}
          inputMode="numeric"
          defaultValue={minutes > 0 ? String(minutes) : ''}
          required
        />
      </div>
      <fieldset className="rounded-card border-line grid gap-2 border p-3 sm:p-4">
        <legend className="text-ink font-semibold">{t.agents}</legend>
        {agents.length ? (
          agents.map((agent) => (
            <label key={agent.agentId} className="flex min-h-11 items-center gap-3">
              <input type="checkbox" name="agents" value={agent.agentId} className="accent-brand size-5" />
              {agent.displayName}
            </label>
          ))
        ) : (
          <Note>{t.noAgent}</Note>
        )}
      </fieldset>
      <SelectField id="passage-equipe" name="team" label={t.team} defaultValue="">
        <option value="">{t.noTeam}</option>
        {teams.map((team) => (
          <option key={team.id} value={team.id}>
            {team.name} ({team.members.map((member) => member.displayName).join(', ') || '—'})
          </option>
        ))}
      </SelectField>
      <FormMessage>{error}</FormMessage>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" aria-busy={pending || undefined} disabled={pending}>
          {pending ? common.sending : t.confirm}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={pending}>
          {common.cancel}
        </Button>
      </div>
    </form>
  );
}
