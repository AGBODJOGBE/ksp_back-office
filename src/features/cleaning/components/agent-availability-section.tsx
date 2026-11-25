'use client';

import { useCallback } from 'react';
import { useResource } from '@/lib/use-resource';
import { availabilityTexts, unavailabilityTexts } from '@/features/cleaning/agent-actions-texts';
import { getAvailability } from '@/features/cleaning/agents-api';
import { AvailabilityForm } from './agent-availability';
import { AgentUnavailabilities } from './agent-unavailabilities';
import { Panel, ResourceView } from './parts';

/**
 * Disponibilités et indisponibilités d'un agent, lues ensemble (`GET /agents/{id}/availability`) ;
 * chaque écriture renvoie l'ensemble à jour, qui remplace l'affichage.
 */
export function AgentAvailabilitySection({ agentId }: { agentId: string }) {
  const availability = useResource(useCallback(() => getAvailability(agentId), [agentId]));
  return (
    <ResourceView resource={availability} lines={6}>
      {(data) => (
        <div className="grid gap-4">
          <Panel title={availabilityTexts.title} id="agent-disponibilites">
            <AvailabilityForm agentId={agentId} availability={data} onSaved={availability.set} />
          </Panel>
          <Panel title={unavailabilityTexts.title} id="agent-indisponibilites">
            <AgentUnavailabilities agentId={agentId} availability={data} onChange={availability.set} />
          </Panel>
        </div>
      )}
    </ResourceView>
  );
}
