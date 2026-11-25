'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { ConfirmAction } from '@/components/ui/confirm-action';
import { FormMessage } from '@/components/ui/field';
import { SelectField } from '@/components/ui/select-field';
import type { AgentOption } from '@/features/cleaning/agents-schemas';
import { assignmentActionTexts } from '@/features/cleaning/assignment-texts';
import { errorText } from '@/features/cleaning/errors';
import { removeAssignment, updateAssignment } from '@/features/cleaning/planning-api';
import type { Assignment, AssignmentBatch, PlanningItem } from '@/features/cleaning/planning-schemas';
import { assignmentStatuses, planningTexts } from '@/features/cleaning/planning-texts';
import { assignmentKey, targetOf } from '@/features/cleaning/planning-view';
import { confirmLabels, ReasonField, reasonError, reasonOf, useKeyed } from './request-parts';
import { Note } from './parts';

const t = assignmentActionTexts;

/** Remplacer, nommer chef, désaffecter : chaque action confirmée avec un motif obligatoire. */
function Actions({
  assignment,
  name,
  agents,
  onDone,
}: {
  assignment: Assignment;
  name: string;
  agents: readonly AgentOption[];
  /** `gone` : l'affectation d'origine n'existe plus (remplacée ou retirée). */
  onDone: (message: string, batch: AssignmentBatch | null, gone: boolean) => void;
}) {
  const keyed = useKeyed();
  const prefix = `affectation-${assignment.id}`;
  const others = agents.filter((agent) => agent.id !== assignment.agentId);
  // Une proposition ne se modifie pas : on la retire, puis on affecte à la main (R-PL-05).
  const editable = assignment.status !== 'proposed';

  async function act(
    data: FormData,
    gone: boolean,
    action: (reason: string) => Promise<[string, AssignmentBatch | null]>,
  ) {
    const reason = reasonOf(data);
    const invalid = reasonError(reason);
    if (invalid) return invalid;
    try {
      const [message, batch] = await action(reason);
      onDone(message, batch, gone);
      return null;
    } catch (error) {
      return errorText(error);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {editable ? (
        <ConfirmAction
          label={t.replace}
          accessibleLabel={t.replaceLabel(name)}
          title={t.replaceTitle(name)}
          confirmLabel={t.confirmLabel}
          labels={confirmLabels}
          onConfirm={(data) => {
            const replaceWithAgentId = String(data.get('agent') ?? '');
            if (!replaceWithAgentId) return Promise.resolve(t.needAgent);
            return act(data, true, async (reason) => [
              t.replaceDone,
              await updateAssignment(assignment.id, { replaceWithAgentId, reason }),
            ]);
          }}
        >
          <SelectField id={`${prefix}-remplacant`} name="agent" label={t.replaceWith} defaultValue="">
            <option value="">{t.chooseAgent}</option>
            {others.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.firstName} {agent.lastName}
              </option>
            ))}
          </SelectField>
          <ReasonField id={`${prefix}-remplacer-motif`} />
        </ConfirmAction>
      ) : null}
      {assignment.isLead || !editable ? null : (
        <ConfirmAction
          label={t.makeLead}
          accessibleLabel={t.makeLeadLabel(name)}
          title={t.makeLeadTitle(name)}
          confirmLabel={t.confirmLabel}
          labels={confirmLabels}
          onConfirm={(data) =>
            act(data, false, async (reason) => [
              t.leadDone,
              await updateAssignment(assignment.id, { isLead: true, reason }),
            ])
          }
        >
          <ReasonField id={`${prefix}-chef-motif`} />
        </ConfirmAction>
      )}
      <ConfirmAction
        danger
        label={t.remove}
        accessibleLabel={t.removeLabel(name)}
        title={t.removeTitle(name)}
        description={t.removeLead}
        confirmLabel={t.remove}
        labels={confirmLabels}
        onConfirm={(data) =>
          act(data, true, async (reason) => {
            await keyed((key) => removeAssignment(assignment.id, reason, key));
            return [t.removeDone, null];
          })
        }
      >
        <ReasonField id={`${prefix}-retirer-motif`} />
      </ConfirmAction>
    </div>
  );
}

/**
 * Agents de l'intervention : nom, chef, confirmation ; actions quand l'écran connaît l'identifiant de
 * l'affectation (affectations faites ou propositions lues ici, le planning ne le donne pas).
 */
export function AssignedAgents({
  item,
  known,
  agents,
  onChanged,
}: {
  item: PlanningItem;
  known: ReadonlyMap<string, Assignment>;
  agents: readonly AgentOption[];
  /** Après une action : affectations renvoyées, et l'affectation d'origine si elle n'existe plus. */
  onChanged: (batch: AssignmentBatch | null, gone: Assignment | null) => void;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const target = targetOf(item);
  const rows = [...item.agents].sort((a, b) => Number(b.isLead) - Number(a.isLead));
  const missingIds = rows.some((agent) => !known.has(assignmentKey(target, agent.agentId)));
  return (
    <section aria-label={t.title} className="grid gap-3">
      <h3 className="text-ink font-semibold">{t.title}</h3>
      {rows.length ? null : <Note>{planningTexts.noAgent}</Note>}
      <ul className="grid gap-2">
        {rows.map((agent) => {
          const name = `${agent.firstName} ${agent.lastName}`;
          const assignment = known.get(assignmentKey(target, agent.agentId));
          return (
            <li key={agent.agentId} className="rounded-control border-line grid gap-2 border p-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-ink font-semibold">{name}</span>
                {agent.isLead ? <Badge tone="brand">{planningTexts.leadBadge}</Badge> : null}
                {assignment ? (
                  <Badge tone={assignmentStatuses[assignment.status].tone}>
                    {assignmentStatuses[assignment.status].label}
                  </Badge>
                ) : (
                  <span className="text-small text-ink-muted">
                    {planningTexts.confirmation[agent.confirmation]}
                  </span>
                )}
              </div>
              {assignment ? (
                <Actions
                  assignment={assignment}
                  name={name}
                  agents={agents}
                  onDone={(done, batch, gone) => {
                    setMessage(done);
                    onChanged(batch, gone ? assignment : null);
                  }}
                />
              ) : null}
            </li>
          );
        })}
      </ul>
      {rows.length && missingIds ? <Note>{t.unknown}</Note> : null}
      <FormMessage tone="success">{message}</FormMessage>
    </section>
  );
}
