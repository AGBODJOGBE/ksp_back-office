'use client';

import { useState } from 'react';
import { ConfirmAction } from '@/components/ui/confirm-action';
import { FormMessage } from '@/components/ui/field';
import { cn } from '@/lib/cn';
import { lifecycleTexts } from '@/features/cleaning/agent-actions-texts';
import {
  approveAgent,
  deactivateAgent,
  reactivateAgent,
  rejectAgent,
  reviewAgent,
  suspendAgent,
} from '@/features/cleaning/agents-api';
import type { Agent } from '@/features/cleaning/agents-schemas';
import { errorCode, errorText } from '@/features/cleaning/errors';
import { confirmLabels, ReasonField, reasonError, reasonOf, useKeyed } from './request-parts';

const t = lifecycleTexts;

export interface AgentStepProps {
  agent: Agent;
  /** Remplace la fiche affichée par la réponse d'une action. */
  onChange: (agent: Agent) => void;
  /** Relit la fiche (après un refus qui dit que l'état a changé). */
  onRefresh: () => void;
  /** Droit de gérer les agents (`cleaning.agent.manage`). */
  canManage: boolean;
}

type Done = keyof typeof t.done;

/** Parcours de la candidature : déposée → en vérification → validée ; l'étape courante est marquée. */
function Steps({ status }: { status: Agent['status'] }) {
  const order = ['applicant', 'under_review', 'active'] as const;
  const reached = order.indexOf(status as (typeof order)[number]);
  const index = reached === -1 && (status === 'suspended' || status === 'deactivated') ? 2 : reached;
  return (
    <ol aria-label={t.stepsLabel} className="flex flex-wrap gap-2">
      {order.map((step, rank) => (
        <li
          key={step}
          aria-current={rank === index ? 'step' : undefined}
          className={cn(
            'rounded-control border-line text-small border px-3 py-1',
            rank <= index ? 'text-ink' : 'text-ink-muted',
            rank === index && 'border-brand bg-brand-soft text-brand-ink font-semibold',
          )}
        >
          {rank + 1}. {t.steps[step]}
        </li>
      ))}
    </ol>
  );
}

/** Message d'un refus : transition périmée (fiche relue), affectations à venir, ou message du serveur. */
function refusal(error: unknown, onRefresh: () => void): string {
  const code = errorCode(error);
  if (code === 'CLEANING_INVALID_TRANSITION') {
    onRefresh();
    return t.invalidTransition;
  }
  if (code === 'CLEANING_AGENT_HAS_ASSIGNMENTS') return t.hasAssignments;
  return errorText(error);
}

/** Cases des compétences déclarées, cochées si déjà validées (lues dans le `FormData`, `skill`). */
function SkillBoxes({ agent }: { agent: Agent }) {
  if (!agent.skills.length) return <FormMessage tone="info">{t.approveNoDeclared}</FormMessage>;
  return (
    <fieldset className="grid gap-2">
      <legend className="text-ink mb-1 font-semibold">{t.approveSkills}</legend>
      {agent.skills.map((skill) => (
        <label key={skill.code} className="flex min-h-11 items-center gap-3">
          <input
            type="checkbox"
            name="skill"
            value={skill.code}
            defaultChecked={skill.validated}
            className="accent-action size-5 shrink-0"
          />
          <span>{skill.name}</span>
        </label>
      ))}
    </fieldset>
  );
}

/**
 * Cycle de vie d'un agent (partie 15.2) : candidat → en vérification → actif ou refusé ; actif ⇄
 * suspendu ; actif ou suspendu → désactivé. Seules les actions permises par le statut sont proposées ;
 * chacune est confirmée, avec motif quand le contrat l'exige.
 */
export function AgentLifecycle({ agent, onChange, onRefresh, canManage }: AgentStepProps) {
  // Une clé par action : un nouvel essai d'une action ne réutilise jamais la clé d'une autre.
  const keys: Record<Done, ReturnType<typeof useKeyed>> = {
    review: useKeyed(),
    approve: useKeyed(),
    reject: useKeyed(),
    suspend: useKeyed(),
    reactivate: useKeyed(),
    deactivate: useKeyed(),
  };
  const [done, setDone] = useState<string | null>(null);
  const status = agent.status;

  const run = async (kind: Done, action: (key: string) => Promise<Agent>): Promise<string | null> => {
    try {
      onChange(await keys[kind](action));
      setDone(t.done[kind]);
      return null;
    } catch (error) {
      return refusal(error, onRefresh);
    }
  };
  const withReason =
    (kind: Done, action: (reason: string, key: string) => Promise<Agent>) => (data: FormData) => {
      const reason = reasonOf(data);
      const invalid = reasonError(reason);
      if (invalid) return Promise.resolve(`${t.reason} : ${invalid}`);
      return run(kind, (key) => action(reason, key));
    };

  const canReject = status === 'applicant' || status === 'under_review';
  const canEnd = status === 'active' || status === 'suspended';

  return (
    <div className="grid gap-3">
      <Steps status={status} />
      <p className="text-ink-muted max-w-reading">{t.explain[status]}</p>
      <FormMessage tone="success">{done}</FormMessage>
      {canManage ? (
        <div className="flex flex-wrap gap-3">
          {status === 'applicant' ? (
            <ConfirmAction
              label={t.review}
              title={t.reviewTitle}
              description={t.reviewText}
              confirmLabel={t.review}
              labels={confirmLabels}
              variant="action"
              onOpen={() => setDone(null)}
              onConfirm={() => run('review', (key) => reviewAgent(agent.id, key))}
            />
          ) : null}
          {status === 'under_review' ? (
            <ConfirmAction
              label={t.approve}
              title={t.approveTitle}
              description={t.approveText}
              confirmLabel={t.approve}
              labels={confirmLabels}
              variant="action"
              onOpen={() => setDone(null)}
              onConfirm={(data) => {
                const codes = data.getAll('skill').map(String);
                if (!codes.length) return Promise.resolve(t.approveNoSkill);
                return run('approve', (key) => approveAgent(agent.id, codes, key));
              }}
            >
              <SkillBoxes agent={agent} />
            </ConfirmAction>
          ) : null}
          {status === 'suspended' ? (
            <ConfirmAction
              label={t.reactivate}
              title={t.reactivateTitle}
              description={t.reactivateText}
              confirmLabel={t.reactivate}
              labels={confirmLabels}
              variant="action"
              onOpen={() => setDone(null)}
              onConfirm={() => run('reactivate', (key) => reactivateAgent(agent.id, key))}
            />
          ) : null}
          {canReject ? (
            <ConfirmAction
              label={t.reject}
              title={t.rejectTitle}
              description={t.rejectText}
              confirmLabel={t.reject}
              labels={confirmLabels}
              danger
              onOpen={() => setDone(null)}
              onConfirm={withReason('reject', (reason, key) => rejectAgent(agent.id, reason, key))}
            >
              <ReasonField id="agent-refus-motif" label={t.reason} />
            </ConfirmAction>
          ) : null}
          {status === 'active' ? (
            <ConfirmAction
              label={t.suspend}
              title={t.suspendTitle}
              description={t.suspendText}
              confirmLabel={t.suspend}
              labels={confirmLabels}
              danger
              onOpen={() => setDone(null)}
              onConfirm={withReason('suspend', (reason, key) => suspendAgent(agent.id, reason, key))}
            >
              <ReasonField id="agent-suspension-motif" label={t.reason} />
            </ConfirmAction>
          ) : null}
          {canEnd ? (
            <ConfirmAction
              label={t.deactivate}
              title={t.deactivateTitle}
              description={t.deactivateText}
              confirmLabel={t.deactivate}
              labels={confirmLabels}
              danger
              onOpen={() => setDone(null)}
              onConfirm={(data) =>
                withReason('deactivate', (reason, key) =>
                  deactivateAgent(agent.id, { reassign: data.get('reassign') === 'on', reason }, key),
                )(data)
              }
            >
              <ReasonField id="agent-desactivation-motif" label={t.reason} />
              <label className="flex min-h-11 items-center gap-3">
                <input type="checkbox" name="reassign" className="accent-action size-5 shrink-0" />
                <span>{t.reassign}</span>
              </label>
            </ConfirmAction>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
