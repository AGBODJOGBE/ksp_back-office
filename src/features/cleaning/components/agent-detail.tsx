'use client';

import { useCallback } from 'react';
import { Heading } from '@/components/ui/heading';
import { formatDate } from '@/lib/format';
import { useResource } from '@/lib/use-resource';
import { lifecycleTexts } from '@/features/cleaning/agent-actions-texts';
import { getAgent } from '@/features/cleaning/agents-api';
import type { Agent } from '@/features/cleaning/agents-schemas';
import { agentName, agentsTexts } from '@/features/cleaning/agents-texts';
import { cleaningPaths } from '@/features/cleaning/paths';
import { cleaningTexts } from '@/features/cleaning/texts';
import { AgentAvailabilitySection } from './agent-availability-section';
import { AgentIdDocument, TemporaryImage } from './agent-id-document';
import { AgentLifecycle, type AgentStepProps } from './agent-lifecycle';
import { AgentStatusBadge, useReferences } from './agent-parts';
import { AgentProfile, AgentStats } from './agent-profile';
import { BackLink, LoadingBlock, Note, Panel, ResourceView, useCleaningAccess } from './parts';

const t = agentsTexts.detail;

function Header({ agent }: { agent: Agent }) {
  const name = agentName(agent);
  return (
    <div className="flex flex-wrap items-center gap-4">
      {agent.photoUrl ? (
        <TemporaryImage
          url={agent.photoUrl}
          alt={name}
          className="border-line size-16 shrink-0 rounded-full border object-cover"
        />
      ) : null}
      <div className="grid gap-2">
        <Heading as="h1" size="h2">
          {name}
        </Heading>
        <div className="flex flex-wrap items-center gap-2">
          <AgentStatusBadge status={agent.status} />
          <span className="text-small text-ink-muted">{t.since(formatDate(agent.createdAt))}</span>
        </div>
      </div>
    </div>
  );
}

/** Fiche d'un agent lue : cycle de vie, identité, activité, pièce d'identité, disponibilités. */
function AgentView(props: AgentStepProps) {
  const references = useReferences();
  const { agent, canManage } = props;
  return (
    <div className="grid gap-4">
      <Header agent={agent} />
      <Panel title={lifecycleTexts.title} id="agent-cycle">
        <AgentLifecycle {...props} />
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={t.identity} id="agent-identite">
          <AgentProfile {...props} references={references} />
        </Panel>
        <div className="grid content-start gap-4">
          <Panel title={t.stats} id="agent-activite">
            <AgentStats agent={agent} />
          </Panel>
          {canManage ? (
            <Panel title={agentsTexts.idDocument.title} id="agent-piece">
              <AgentIdDocument agent={agent} />
            </Panel>
          ) : null}
        </div>
      </div>
      <AgentAvailabilitySection agentId={agent.id} />
    </div>
  );
}

function AgentScreen({ id, canManage }: { id: string; canManage: boolean }) {
  const agent = useResource(useCallback(() => getAgent(id), [id]));
  return (
    <ResourceView resource={agent} lines={10}>
      {(data) => (
        <AgentView agent={data} onChange={agent.set} onRefresh={agent.refresh} canManage={canManage} />
      )}
    </ResourceView>
  );
}

/** Fiche agent (`/nettoyage/equipe/agents/[id]`), lue par le navigateur une fois la session reprise. */
export function AgentDetail({ id }: { id: string }) {
  const access = useCleaningAccess();
  return (
    <div className="grid gap-4">
      <BackLink href={cleaningPaths.team}>{t.back}</BackLink>
      {!access ? (
        <LoadingBlock lines={8} />
      ) : access['cleaning.planning.manage'] ? (
        <AgentScreen id={id} canManage={access['cleaning.agent.manage']} />
      ) : (
        <Note>{cleaningTexts.common.forbidden}</Note>
      )}
    </div>
  );
}
