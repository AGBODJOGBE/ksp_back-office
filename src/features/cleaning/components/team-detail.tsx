'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmAction } from '@/components/ui/confirm-action';
import { FormMessage } from '@/components/ui/field';
import { Heading } from '@/components/ui/heading';
import { formatDate } from '@/lib/format';
import { useResource } from '@/lib/use-resource';
import { createTeam, getTeam, updateTeam } from '@/features/cleaning/agents-api';
import type { Team } from '@/features/cleaning/agents-schemas';
import { agentName } from '@/features/cleaning/agents-texts';
import { attempt } from '@/features/cleaning/errors';
import { cleaningPaths } from '@/features/cleaning/paths';
import { teamsTexts } from '@/features/cleaning/teams-texts';
import { cleaningTexts } from '@/features/cleaning/texts';
import { AgentStatusBadge } from './agent-parts';
import { RowLink } from './catalog-parts';
import { ActiveBadge, BackLink, LoadingBlock, Note, Panel, ResourceView, useCleaningAccess } from './parts';
import { confirmLabels, useKeyed } from './request-parts';
import { TeamForm } from './team-form';

const t = teamsTexts.detail;
const c = cleaningTexts.common;

function Members({ team }: { team: Team }) {
  if (!team.members.length) return <Note>{t.noMembers}</Note>;
  return (
    <ul className="grid gap-2">
      {team.members.map((member) => (
        <li key={member.agentId} className="relative flex flex-wrap items-center gap-2">
          <RowLink href={cleaningPaths.agent(member.agentId)}>{agentName(member)}</RowLink>
          {member.agentId === team.leadAgentId ? <Badge tone="brand">{t.leadBadge}</Badge> : null}
          <AgentStatusBadge status={member.status} />
        </li>
      ))}
    </ul>
  );
}

function TeamView({
  team,
  canManage,
  onChange,
}: {
  team: Team;
  canManage: boolean;
  onChange: (team: Team) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const toggle = (active: boolean) =>
    attempt(async () => {
      onChange(await updateTeam(team.id, { active }));
      setDone(active ? t.reactivated : t.deactivated);
    });
  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Heading as="h1" size="h2">
          {team.name}
        </Heading>
        <div className="flex flex-wrap items-center gap-2">
          <ActiveBadge active={team.active} feminine />
          <span className="text-small text-ink-muted">{t.created(formatDate(team.createdAt))}</span>
        </div>
      </div>
      <FormMessage tone="success">{done}</FormMessage>
      <Panel title={t.members} id="equipe-membres">
        <Members team={team} />
      </Panel>
      {canManage ? (
        <Panel title={t.edit} id="equipe-modifier">
          {editing ? (
            <TeamForm
              team={team}
              submitLabel={teamsTexts.form.save}
              onSubmit={async ({ changes }) => {
                if (Object.keys(changes).length) onChange(await updateTeam(team.id, changes));
                return teamsTexts.form.saved;
              }}
            />
          ) : (
            <Button variant="secondary" className="justify-self-start" onClick={() => setEditing(true)}>
              {t.edit}
            </Button>
          )}
          <div className="flex flex-wrap gap-3">
            {team.active ? (
              <ConfirmAction
                label={t.deactivate}
                title={t.deactivateTitle}
                description={t.deactivateText}
                confirmLabel={t.deactivate}
                labels={confirmLabels}
                danger
                onOpen={() => setDone(null)}
                onConfirm={() => toggle(false)}
              />
            ) : (
              <ConfirmAction
                label={t.reactivate}
                title={t.reactivate}
                confirmLabel={t.reactivate}
                labels={confirmLabels}
                variant="action"
                onOpen={() => setDone(null)}
                onConfirm={() => toggle(true)}
              />
            )}
          </div>
        </Panel>
      ) : (
        <Note>{t.readOnly}</Note>
      )}
    </div>
  );
}

function TeamScreen({ id, canManage }: { id: string; canManage: boolean }) {
  const team = useResource(useCallback(() => getTeam(id), [id]));
  return (
    <ResourceView resource={team} lines={8}>
      {(data) => <TeamView team={data} canManage={canManage} onChange={team.set} />}
    </ResourceView>
  );
}

/** Fiche équipe (`/nettoyage/equipe/equipes/[id]`) : membres, chef d'équipe, modification, désactivation. */
export function TeamDetail({ id }: { id: string }) {
  const access = useCleaningAccess();
  return (
    <div className="grid gap-4">
      <BackLink href={cleaningPaths.teams}>{t.back}</BackLink>
      {!access ? (
        <LoadingBlock lines={8} />
      ) : access['cleaning.planning.manage'] ? (
        <TeamScreen id={id} canManage={access['cleaning.agent.manage']} />
      ) : (
        <Note>{c.forbidden}</Note>
      )}
    </div>
  );
}

/** Nouvelle équipe (`/nettoyage/equipe/equipes/nouvelle`) : créée puis ouverte sur sa fiche. */
export function NewTeam() {
  const access = useCleaningAccess();
  const router = useRouter();
  const keyed = useKeyed();
  return (
    <div className="grid gap-4">
      <BackLink href={cleaningPaths.teams}>{t.back}</BackLink>
      <Heading as="h1" size="h2">
        {teamsTexts.form.newTitle}
      </Heading>
      {!access ? (
        <LoadingBlock lines={6} />
      ) : access['cleaning.agent.manage'] ? (
        <TeamForm
          submitLabel={teamsTexts.form.create}
          onSubmit={async ({ full }) => {
            const team = await keyed((key) => createTeam(full, key));
            router.push(cleaningPaths.teamDetail(team.id));
            return teamsTexts.form.created;
          }}
        />
      ) : (
        <Note>{t.readOnly}</Note>
      )}
    </div>
  );
}
