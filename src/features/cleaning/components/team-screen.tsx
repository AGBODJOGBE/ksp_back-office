'use client';

import { Badge } from '@/components/ui/badge';
import { ConfirmAction } from '@/components/ui/confirm-action';
import { TextField } from '@/components/ui/field';
import { ResponsiveTable, type TableColumn } from '@/components/ui/responsive-table';
import { beninInputToIso, formatDateTime } from '@/lib/format';
import { useResource } from '@/lib/use-resource';
import {
  createTeam,
  declareUnavailability,
  listAgents,
  listTeams,
  updateTeam,
} from '@/features/cleaning/api';
import { attempt } from '@/features/cleaning/errors';
import type { Agent, Team } from '@/features/cleaning/schemas';
import { teamTexts as t } from '@/features/cleaning/team-texts';
import { cleaningTexts } from '@/features/cleaning/texts';
import { Note, Panel, ResourceView, useCleaningAccess } from './parts';
import { RegisterAgentDialog } from './register-agent';

const common = cleaningTexts.common;
const dialog = { cancel: common.cancel, pending: common.sending };

const value = (data: FormData, name: string) => String(data.get(name) ?? '').trim();

async function loadAll() {
  const [agents, teams] = await Promise.all([listAgents(), listTeams()]);
  return { agents, teams };
}

type Data = Awaited<ReturnType<typeof loadAll>>;

function UnavailabilityDialog({ agent, onDone }: { agent: Agent; onDone: (agent: Agent) => void }) {
  const u = t.unavailable;
  return (
    <ConfirmAction
      label={u.label}
      accessibleLabel={`${u.label} : ${agent.displayName}`}
      title={u.title(agent.displayName)}
      confirmLabel={u.confirm}
      labels={dialog}
      onConfirm={async (data) => {
        const start = beninInputToIso(value(data, 'start'));
        const end = beninInputToIso(value(data, 'end'));
        if (!start || !end) return common.invalidDate;
        const reason = value(data, 'reason');
        return attempt(async () =>
          onDone(await declareUnavailability(agent.agentId, { start, end, ...(reason ? { reason } : {}) })),
        );
      }}
    >
      <p className="text-small text-ink-muted">{common.beninTime}</p>
      <TextField
        id={`indispo-debut-${agent.agentId}`}
        name="start"
        type="datetime-local"
        label={u.start}
        required
      />
      <TextField
        id={`indispo-fin-${agent.agentId}`}
        name="end"
        type="datetime-local"
        label={u.end}
        required
      />
      <TextField id={`indispo-motif-${agent.agentId}`} name="reason" label={u.reason} maxLength={200} />
    </ConfirmAction>
  );
}

function agentColumns(administer: boolean, onAgent: (agent: Agent) => void): TableColumn<Agent>[] {
  const columns: TableColumn<Agent>[] = [
    { key: 'name', header: t.columns.name, primary: true, cell: (agent) => agent.displayName },
    {
      key: 'state',
      header: t.columns.state,
      cell: (agent) => (
        <Badge tone={agent.active ? 'success' : 'neutral'}>{agent.active ? t.active : t.inactive}</Badge>
      ),
    },
    {
      key: 'unavailabilities',
      header: t.columns.unavailabilities,
      cell: (agent) =>
        agent.unavailabilities.length ? (
          <ul className="grid gap-1">
            {agent.unavailabilities.map((item) => (
              <li key={item.id}>
                {t.unavailability(formatDateTime(item.start), formatDateTime(item.end), item.reason)}
              </li>
            ))}
          </ul>
        ) : (
          t.noUnavailability
        ),
    },
    {
      key: 'account',
      header: t.columns.account,
      cell: (agent) => <code className="text-small break-all">{agent.agentId}</code>,
    },
  ];
  if (administer) {
    columns.push({
      key: 'action',
      header: common.actions,
      cell: (agent) => <UnavailabilityDialog agent={agent} onDone={onAgent} />,
    });
  }
  return columns;
}

/** Composition d'une équipe : création (`team` absent) ou modification. */
function TeamDialog({
  agents,
  team,
  onDone,
}: {
  agents: Agent[];
  team?: Team;
  onDone: (team: Team) => void;
}) {
  const members = new Set(team?.members.map((member) => member.agentId));
  const prefix = team ? `equipe-${team.id}` : 'equipe-nouvelle';
  return (
    <ConfirmAction
      label={team ? t.editTeam : t.createTeam}
      accessibleLabel={team ? `${t.editTeam} ${team.name}` : undefined}
      variant={team ? 'secondary' : 'primary'}
      title={team ? t.teamTitleEdit(team.name) : t.teamTitleNew}
      confirmLabel={t.teamConfirm}
      labels={dialog}
      onConfirm={async (data) => {
        const name = value(data, 'name');
        if (!name) return `${t.teamName} : ${common.required}`;
        const input = { name, memberIds: data.getAll('members').map(String) };
        return attempt(async () => onDone(await (team ? updateTeam(team.id, input) : createTeam(input))));
      }}
    >
      <TextField
        id={`${prefix}-nom`}
        name="name"
        label={t.teamName}
        defaultValue={team?.name}
        maxLength={100}
        required
      />
      <fieldset className="grid gap-1">
        <legend className="text-ink mb-1 font-semibold">{t.teamMembers}</legend>
        {agents.length ? (
          agents.map((agent) => (
            <label key={agent.agentId} className="flex min-h-11 items-center gap-3">
              <input
                type="checkbox"
                name="members"
                value={agent.agentId}
                defaultChecked={members.has(agent.agentId)}
                className="accent-brand size-5"
              />
              {agent.displayName}
            </label>
          ))
        ) : (
          <Note>{t.agentsEmpty}</Note>
        )}
      </fieldset>
    </ConfirmAction>
  );
}

function TeamView({ data, onChange }: { data: Data; onChange: (data: Data) => void }) {
  const access = useCleaningAccess();
  const administer = !!access?.administer;
  const setAgent = (agent: Agent) =>
    onChange({ ...data, agents: [...data.agents.filter((item) => item.agentId !== agent.agentId), agent] });
  const setTeam = (team: Team) =>
    onChange({ ...data, teams: [...data.teams.filter((item) => item.id !== team.id), team] });

  return (
    <div className="grid gap-6">
      {administer ? null : <Note>{t.adminWrites}</Note>}
      <Panel
        title={t.agents}
        id="equipe-agents"
        action={administer ? <RegisterAgentDialog onDone={setAgent} /> : null}
      >
        {data.agents.length ? (
          <ResponsiveTable
            caption={t.agentsCaption}
            columns={agentColumns(administer, setAgent)}
            rows={data.agents}
            rowKey={(agent) => agent.agentId}
          />
        ) : (
          <Note>{t.agentsEmpty}</Note>
        )}
      </Panel>

      <Panel
        title={t.teams}
        id="equipe-equipes"
        action={administer ? <TeamDialog agents={data.agents} onDone={setTeam} /> : null}
      >
        {data.teams.length ? (
          <ul className="grid gap-3 md:grid-cols-2">
            {data.teams.map((team) => (
              <li key={team.id} className="rounded-card border-line grid gap-2 border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-ink font-semibold">{team.name}</p>
                  <Badge>{t.members(team.members.length)}</Badge>
                </div>
                <p className="text-small text-ink-muted">
                  {team.members.map((member) => member.displayName).join(', ') || t.noMember}
                </p>
                {administer ? (
                  <div>
                    <TeamDialog agents={data.agents} team={team} onDone={setTeam} />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <Note>{t.teamsEmpty}</Note>
        )}
      </Panel>
    </div>
  );
}

/** Agents de terrain, indisponibilités et équipes (UC-CL-12). Lecture : superviseur et admin ; écriture : admin. */
export function TeamScreen() {
  const resource = useResource(loadAll);
  return (
    <ResourceView resource={resource}>
      {(data) => <TeamView data={data} onChange={resource.set} />}
    </ResourceView>
  );
}
