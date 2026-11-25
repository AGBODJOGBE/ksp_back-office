'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { ConfirmAction } from '@/components/ui/confirm-action';
import { FormMessage, TextField } from '@/components/ui/field';
import { ResponsiveTable, type TableColumn } from '@/components/ui/responsive-table';
import { SelectField, TextAreaField } from '@/components/ui/select-field';
import { beninDay, beninInputToIso, formatDateTime, formatSlot } from '@/lib/format';
import { unavailabilityTexts } from '@/features/cleaning/agent-actions-texts';
import {
  declareUnavailability,
  removeUnavailability,
  type UnavailabilityBody,
} from '@/features/cleaning/agents-api';
import {
  type Availability,
  type Unavailability,
  UNAVAILABILITY_KINDS,
  type UnavailabilityKind,
} from '@/features/cleaning/agents-schemas';
import { unavailabilityKindName } from '@/features/cleaning/agents-texts';
import { attempt, errorCode, errorText } from '@/features/cleaning/errors';
import { optionalText } from '@/features/cleaning/inputs';
import { Note } from './parts';
import { confirmLabels, useKeyed } from './request-parts';

const t = unavailabilityTexts;
const NOTE_MAX = 300;

/** Période lisible : créneau d'un jour, ou du … au … sur plusieurs jours (heure du Bénin). */
export function formatPeriod(slot: { start: string; end: string }): string {
  return beninDay(slot.start) === beninDay(slot.end)
    ? formatSlot(slot)
    : `${formatDateTime(slot.start)} → ${formatDateTime(slot.end)}`;
}

/** Corps de la déclaration lu dans la boîte, ou le message d'erreur à afficher. */
function declarationBody(data: FormData): UnavailabilityBody | string {
  const start = beninInputToIso(String(data.get('start') ?? ''));
  const end = beninInputToIso(String(data.get('end') ?? ''));
  if (!start || !end || new Date(end).getTime() <= new Date(start).getTime()) return t.invalid;
  const note = optionalText(String(data.get('note') ?? ''));
  if (note && note.length > NOTE_MAX) return `${t.note} : ${NOTE_MAX} caractères au plus.`;
  const kind = String(data.get('kind') ?? 'leave') as UnavailabilityKind;
  return { start, end, kind, note, force: data.get('force') === 'on' ? true : undefined };
}

/**
 * Indisponibilités d'un agent (R-DS-02) : à venir et en cours, déclarées ou retirées par le
 * superviseur. Une période qui chevauche des affectations est refusée avec la liste, sauf « Forcer »
 * (l'agent est désaffecté et la planification relance ces séances, R-DS-04).
 */
export function AgentUnavailabilities({
  agentId,
  availability,
  onChange,
}: {
  agentId: string;
  availability: Availability;
  onChange: (availability: Availability) => void;
}) {
  const keyed = useKeyed();
  const [done, setDone] = useState<string | null>(null);

  const columns: TableColumn<Unavailability>[] = [
    { key: 'period', header: t.columns.period, primary: true, cell: (row) => formatPeriod(row) },
    {
      key: 'kind',
      header: t.columns.kind,
      cell: (row) => (
        <span className="flex flex-wrap items-center gap-2">
          {unavailabilityKindName(row.kind)}
          {row.forced ? <Badge tone="warning">{t.forced}</Badge> : null}
        </span>
      ),
    },
    { key: 'note', header: t.columns.note, cell: (row) => row.note ?? '—' },
    { key: 'by', header: t.columns.by, cell: (row) => row.createdByName ?? t.someone },
    {
      key: 'actions',
      header: t.columns.actions,
      cell: (row) => (
        <ConfirmAction
          label={t.remove}
          accessibleLabel={t.removeLabel(formatPeriod(row))}
          title={t.removeTitle}
          description={`${formatPeriod(row)}. ${t.removeText}`}
          confirmLabel={t.remove}
          labels={confirmLabels}
          danger
          onOpen={() => setDone(null)}
          onConfirm={() =>
            attempt(async () => {
              onChange(await removeUnavailability(agentId, row.id));
              setDone(t.removed);
            })
          }
        />
      ),
    },
  ];

  return (
    <div className="grid gap-4">
      <p className="text-small text-ink-muted">{t.hint}</p>
      {availability.unavailabilities.length ? (
        <ResponsiveTable
          caption={t.caption}
          columns={columns}
          rows={availability.unavailabilities}
          rowKey={(row) => row.id}
        />
      ) : (
        <Note>{t.none}</Note>
      )}
      <FormMessage tone="success">{done}</FormMessage>
      <ConfirmAction
        label={t.add}
        title={t.addTitle}
        description={t.addText}
        confirmLabel={t.add}
        labels={confirmLabels}
        className="justify-self-start"
        onOpen={() => setDone(null)}
        onConfirm={async (data) => {
          const body = declarationBody(data);
          if (typeof body === 'string') return body;
          try {
            onChange(await keyed((key) => declareUnavailability(agentId, body, key)));
            setDone(t.declared);
            return null;
          } catch (error) {
            return errorCode(error) === 'CLEANING_UNAVAILABILITY_CONFLICT'
              ? `${errorText(error)} ${t.conflict}`
              : errorText(error);
          }
        }}
      >
        <TextField id="indispo-debut" name="start" type="datetime-local" label={t.start} required />
        <TextField id="indispo-fin" name="end" type="datetime-local" label={t.end} required />
        <SelectField id="indispo-motif" name="kind" label={t.kind} defaultValue="leave">
          {UNAVAILABILITY_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {unavailabilityKindName(kind)}
            </option>
          ))}
        </SelectField>
        <TextAreaField id="indispo-note" name="note" label={t.note} hint={t.noteHint} maxLength={NOTE_MAX} />
        <label className="flex min-h-11 items-center gap-3">
          <input type="checkbox" name="force" className="accent-action size-5 shrink-0" />
          <span>{t.force}</span>
        </label>
      </ConfirmAction>
    </div>
  );
}
