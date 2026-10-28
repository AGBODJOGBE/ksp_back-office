'use client';

import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmAction } from '@/components/ui/confirm-action';
import { DescriptionList } from '@/components/ui/description-list';
import { FormMessage } from '@/components/ui/field';
import { Heading } from '@/components/ui/heading';
import { IconCheck, IconImage } from '@/components/ui/icons';
import { TextAreaField } from '@/components/ui/select-field';
import { formatDateTime, formatDuration } from '@/lib/format';
import { useResource } from '@/lib/use-resource';
import {
  getMission,
  type InterventionAction,
  interventionAction,
  reportIncident,
  updateChecklist,
} from '@/features/cleaning/api';
import { attempt, errorText } from '@/features/cleaning/errors';
import { interventionTexts as t } from '@/features/cleaning/mission-texts';
import { cleaningPaths } from '@/features/cleaning/paths';
import type { Intervention, Mission } from '@/features/cleaning/schemas';
import { cleaningTexts, interventionStatuses } from '@/features/cleaning/texts';
import { BackLink, Note, Panel, ResourceView, StatusBadge } from './parts';

const common = cleaningTexts.common;
const dialog = { cancel: common.cancel, pending: common.sending };

function Checklist({
  intervention,
  editable,
  onChange,
}: {
  intervention: Intervention;
  editable: boolean;
  onChange: (mission: Mission) => void;
}) {
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);

  async function toggle(code: string) {
    if (saving) return;
    const doneCodes = intervention.checklist
      .filter((item) => (item.code === code ? !item.done : item.done))
      .map((item) => item.code);
    setSaving(code);
    setMessage(null);
    try {
      onChange(await updateChecklist(intervention.id, doneCodes));
      setMessage({ error: false, text: t.checklistSaved });
    } catch (caught) {
      setMessage({ error: true, text: errorText(caught) });
    } finally {
      setSaving(null);
    }
  }

  if (!intervention.checklist.length) return <Note>{t.checklistEmpty}</Note>;
  return (
    <fieldset className="grid gap-2" aria-busy={saving ? true : undefined}>
      <legend className="sr-only">{t.checklist}</legend>
      {editable ? <p className="text-small text-ink-muted mb-1">{t.checklistHint}</p> : null}
      {intervention.checklist.map((item) => (
        <label
          key={item.code}
          className="rounded-control border-line has-[:checked]:bg-success-soft has-[:checked]:border-success flex min-h-14 items-center gap-4 border px-4 py-3 has-[:disabled]:opacity-70"
        >
          <input
            type="checkbox"
            // Affichage optimiste pendant l'enregistrement ; la réponse de la gateway fait foi ensuite.
            checked={saving === item.code ? !item.done : item.done}
            disabled={!editable || !!saving}
            onChange={() => toggle(item.code)}
            className="accent-success size-6 shrink-0"
          />
          <span className="text-ink font-medium">{item.label}</span>
          {saving === item.code ? (
            <span className="text-small text-ink-muted ml-auto">{t.checklistSaving}</span>
          ) : null}
        </label>
      ))}
      <FormMessage tone={message?.error ? 'error' : 'info'}>{message?.text}</FormMessage>
    </fieldset>
  );
}

function Actions({
  intervention,
  onChange,
}: {
  intervention: Intervention;
  onChange: (mission: Mission) => void;
}) {
  const [pending, setPending] = useState<InterventionAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: InterventionAction) {
    if (pending) return;
    setPending(action);
    setError(null);
    try {
      onChange(await interventionAction(intervention.id, action));
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setPending(null);
    }
  }

  const big = 'min-h-14 w-full text-base sm:w-auto';
  const { status } = intervention;
  if (status === 'completed' || status === 'cancelled') return <Note>{t.closedState}</Note>;
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:flex sm:flex-wrap">
        {status === 'planned' ? (
          <Button
            size="lg"
            className={big}
            onClick={() => run('start')}
            aria-busy={pending === 'start' || undefined}
            disabled={!!pending}
          >
            {pending === 'start' ? common.sending : t.start}
          </Button>
        ) : null}
        {status === 'on_hold' ? (
          <Button
            size="lg"
            className={big}
            onClick={() => run('resume')}
            aria-busy={pending === 'resume' || undefined}
            disabled={!!pending}
          >
            {pending === 'resume' ? common.sending : t.resume}
          </Button>
        ) : null}
        {status === 'in_progress' ? (
          <ConfirmAction
            label={
              <>
                <IconCheck />
                {t.complete.label}
              </>
            }
            variant="primary"
            className={big}
            title={t.complete.title}
            description={t.complete.text}
            confirmLabel={t.complete.confirm}
            labels={dialog}
            onConfirm={() =>
              attempt(async () => onChange(await interventionAction(intervention.id, 'complete')))
            }
          />
        ) : null}
        {status === 'in_progress' ? (
          <ConfirmAction
            label={t.incident.label}
            className={big}
            title={t.incident.title}
            description={t.incident.text}
            confirmLabel={t.incident.confirm}
            labels={dialog}
            danger
            onConfirm={async (data) => {
              const note = String(data.get('note') ?? '').trim();
              if (!note) return common.required;
              return attempt(async () => onChange(await reportIncident(intervention.id, note)));
            }}
          >
            <TextAreaField
              id="incident-note"
              name="note"
              label={t.incident.field}
              maxLength={2000}
              rows={4}
              required
            />
          </ConfirmAction>
        ) : null}
      </div>
      <FormMessage>{error}</FormMessage>
    </div>
  );
}

function InterventionView({
  mission,
  interventionId,
  onChange,
}: {
  mission: Mission;
  interventionId: string;
  onChange: (mission: Mission) => void;
}) {
  const intervention = mission.interventions.find((item) => item.id === interventionId);
  const back = <BackLink href={cleaningPaths.mission(mission.id)}>{t.back}</BackLink>;
  if (!intervention) {
    return (
      <div className="grid gap-3">
        {back}
        <Note>{t.notFound}</Note>
      </div>
    );
  }
  return (
    <div className="grid gap-5">
      <div className="grid gap-2">
        {back}
        <div className="flex flex-wrap items-center gap-3">
          <Heading as="h1" size="h2">
            {t.title}
          </Heading>
          <StatusBadge map={interventionStatuses} code={intervention.status} />
        </div>
        <p className="text-lead text-ink font-semibold">{formatDateTime(intervention.scheduledStart)}</p>
        <p className="text-ink-muted">{`${mission.address}, ${mission.commune}`}</p>
      </div>

      <Actions intervention={intervention} onChange={onChange} />

      {intervention.incidentNote ? (
        <div className="rounded-card border-danger bg-danger-soft border p-4">
          <p className="text-small text-danger font-semibold">{t.incidentNote}</p>
          <p className="text-ink mt-1 whitespace-pre-line">{intervention.incidentNote}</p>
        </div>
      ) : null}

      <Panel title={t.checklist} id="passage-liste">
        <Checklist
          key={intervention.status}
          intervention={intervention}
          editable={intervention.status === 'in_progress'}
          onChange={onChange}
        />
      </Panel>

      <Panel title={t.photos} id="passage-photos">
        <div className="text-ink-muted flex items-start gap-3">
          <IconImage className="mt-0.5" />
          <div className="grid gap-1">
            <p className="text-small">{t.photosUnavailable}</p>
            <p className="text-small">
              {t.photosCount(intervention.beforePhotoFileIds.length, intervention.afterPhotoFileIds.length)}
            </p>
          </div>
        </div>
      </Panel>

      <Panel title={cleaningTexts.common.details} id="passage-details">
        <DescriptionList
          items={[
            { term: t.duration, value: formatDuration(intervention.durationMinutes) },
            {
              term: t.agents,
              value: intervention.agents.map((agent) => agent.displayName).join(', ') || null,
            },
            {
              term: t.started,
              value: intervention.startedAt ? formatDateTime(intervention.startedAt) : null,
            },
            {
              term: t.completed,
              value: intervention.completedAt ? formatDateTime(intervention.completedAt) : null,
            },
          ]}
        />
      </Panel>
    </div>
  );
}

/**
 * Passage d'une mission, pensé pour le téléphone de l'agent : grandes cibles, action principale en
 * haut, liste de contrôle enregistrée case par case. Lu dans la mission (pas de route de lecture d'un
 * passage seul dans le contrat).
 */
export function InterventionScreen({
  missionId,
  interventionId,
}: {
  missionId: string;
  interventionId: string;
}) {
  const mission = useResource(useCallback(() => getMission(missionId), [missionId]));
  return (
    <ResourceView resource={mission} lines={5}>
      {(data) => <InterventionView mission={data} interventionId={interventionId} onChange={mission.set} />}
    </ResourceView>
  );
}
