'use client';

import Link from 'next/link';
import { type ReactNode, useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { useResource } from '@/lib/use-resource';
import { parseInteger } from '@/features/cleaning/inputs';
import { cleaningPaths } from '@/features/cleaning/paths';
import { programChangeTexts } from '@/features/cleaning/program-detail-texts';
import { type AmendmentBody, createAmendment } from '@/features/cleaning/programs-api';
import type { Program } from '@/features/cleaning/programs-schemas';
import {
  type ScheduleDraft,
  scheduleDraftOf,
  scheduleErrors,
  scheduleOf,
} from '@/features/cleaning/schedule-plan';
import type { Parameter } from '@/features/cleaning/schemas';
import { cleaningTexts } from '@/features/cleaning/texts';
import { CheckField, FieldGroup } from './editors';
import type { ProgramProps } from './program-detail';
import { useKeyed } from './request-parts';
import {
  loadValueReferences,
  type ValueDraft,
  type ValueReferences,
  valueErrors,
  ValueFields,
  valuesOf,
} from './request-values';
import { type FieldErrors, FormFooter, Note, Panel, ResourceView, useFormSubmit } from './parts';
import { ScheduleFields } from './schedule-fields';

const t = programChangeTexts.amendment;
const c = cleaningTexts.common;
const FIELDS = [
  'addCleaningTypeIds',
  'addSchedule',
  'values',
  'teamSize',
  'durationMinutes',
  'validityDays',
] as const;
const RANGES = { teamSize: [1, 50], durationMinutes: [15, 1440], validityDays: [1, 90] } as const;
type IntField = keyof typeof RANGES;

/** Offres actives du lieu dont le type ne fait pas encore partie du programme. */
function addableOffers(refs: ValueReferences, program: Program) {
  const current = new Set(program.cleaningTypes.map((type) => type.id));
  const names = new Map(refs.types.map((type) => [type.id, type.name]));
  return refs.offers
    .filter((offer) => offer.active && !current.has(offer.cleaningTypeId))
    .map((offer) => ({ offer, name: names.get(offer.cleaningTypeId) ?? offer.cleaningTypeId }));
}

/** Paramètres propres aux offres ajoutées (ceux du lieu sont déjà connus du dossier). */
function extraParameters(refs: ValueReferences, typeIds: readonly string[]): Parameter[] {
  const placeIds = new Set(refs.place.parameters.map((item) => item.parameterId));
  const ids = refs.offers
    .filter((offer) => typeIds.includes(offer.cleaningTypeId))
    .flatMap((offer) => [...offer.extraParameters].sort((a, b) => a.order - b.order))
    .map((item) => item.parameterId)
    .filter((id) => !placeIds.has(id));
  const byId = new Map(refs.parameters.map((parameter) => [parameter.id, parameter]));
  return [...new Set(ids)].flatMap((id) => byId.get(id) ?? []);
}

function Form({
  program,
  refs,
  onClose,
}: ProgramProps & { refs: ValueReferences; onClose: (message?: ReactNode) => void }) {
  const keyed = useKeyed();
  const form = useFormSubmit(FIELDS);
  const offers = addableOffers(refs, program);
  const [typeIds, setTypeIds] = useState<string[]>([]);
  const [values, setValues] = useState<ValueDraft>({});
  const [schedule, setSchedule] = useState<ScheduleDraft>(() => scheduleDraftOf(null));
  const [ints, setInts] = useState<Record<IntField, string>>({
    teamSize: '',
    durationMinutes: '',
    validityDays: '',
  });
  const parameters = extraParameters(refs, typeIds);

  function validate(): FieldErrors {
    const errors: FieldErrors = {
      ...valueErrors(values, parameters),
      ...scheduleErrors(schedule, 'addSchedule', c.required),
    };
    if (!typeIds.length && schedule.kind === 'none') errors.addCleaningTypeIds = t.empty;
    for (const [field, [min, max]] of Object.entries(RANGES) as [IntField, readonly [number, number]][]) {
      const raw = ints[field].trim();
      const value = raw ? parseInteger(raw) : undefined;
      if (value === null || (value !== undefined && (value < min || value > max)))
        errors[field] = t.range(min, max);
    }
    return errors;
  }

  function body(): AmendmentBody {
    const result: AmendmentBody = {};
    if (typeIds.length) result.addCleaningTypeIds = typeIds;
    const plan = scheduleOf(schedule);
    if (plan) result.addSchedule = plan;
    const filled = valuesOf(values, parameters);
    if (Object.keys(filled).length) result.values = filled;
    for (const field of Object.keys(RANGES) as IntField[]) {
      const raw = ints[field].trim();
      if (raw) result[field] = parseInteger(raw) ?? 0;
    }
    return result;
  }

  return (
    <form
      noValidate
      className="grid gap-5"
      onSubmit={(event) =>
        form.submit(event, validate(), async () => {
          const quote = await keyed((key) => createAmendment(program.id, body(), key));
          onClose(
            <>
              {t.done(quote.requestNumber)}{' '}
              <Link href={cleaningPaths.request(quote.requestId)} className="underline">
                {t.openRequest}
              </Link>
            </>,
          );
        })
      }
    >
      <FieldGroup
        id="avenant-types"
        legend={t.types}
        hint={t.typesHint}
        error={form.errors.addCleaningTypeIds}
      >
        {offers.length ? (
          <div className="grid gap-1 sm:grid-cols-2">
            {offers.map(({ offer, name }) => (
              <CheckField
                key={offer.id}
                id={`avenant-type-${offer.cleaningTypeId}`}
                label={name}
                checked={typeIds.includes(offer.cleaningTypeId)}
                onChange={(checked) =>
                  setTypeIds((previous) =>
                    checked
                      ? [...previous, offer.cleaningTypeId]
                      : previous.filter((id) => id !== offer.cleaningTypeId),
                  )
                }
              />
            ))}
          </div>
        ) : (
          <Note>{t.noType}</Note>
        )}
      </FieldGroup>
      {parameters.length ? (
        <FieldGroup id="avenant-valeurs" legend={t.values}>
          <ValueFields
            idPrefix="avenant-valeur"
            parameters={parameters}
            draft={values}
            errors={form.errors}
            onChange={(code, value) => setValues((previous) => ({ ...previous, [code]: value }))}
          />
        </FieldGroup>
      ) : null}
      <ScheduleFields
        idPrefix="avenant-seances"
        prefix="addSchedule"
        legend={t.addSchedule}
        noneLabel={t.noSchedule}
        draft={schedule}
        errors={form.errors}
        change={(patch) => setSchedule((previous) => ({ ...previous, ...patch }))}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        {(
          [
            ['teamSize', t.teamSize],
            ['durationMinutes', t.duration],
            ['validityDays', t.validity],
          ] as const
        ).map(([field, label]) => (
          <TextField
            key={field}
            id={`avenant-${field}`}
            label={label}
            hint={t.proposedHint}
            inputMode="numeric"
            value={ints[field]}
            error={form.errors[field]}
            onChange={(event) => setInts((previous) => ({ ...previous, [field]: event.target.value }))}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <FormFooter pending={form.pending} message={form.message} label={t.submit} pendingLabel={c.sending} />
        <Button variant="ghost" onClick={() => onClose()}>
          {c.cancel}
        </Button>
      </div>
    </form>
  );
}

/** Préparer un avenant (R-PG-06) : devis complémentaire en brouillon, à vérifier et envoyer depuis le dossier. */
export function AmendmentForm(props: ProgramProps & { onClose: (message?: ReactNode) => void }) {
  const placeTypeId = props.program.place.placeTypeId;
  const refs = useResource(useCallback(() => loadValueReferences(placeTypeId), [placeTypeId]));
  return (
    <Panel title={t.title} id="programme-avenant">
      <p className="text-ink-muted max-w-reading">{t.lead}</p>
      <ResourceView resource={refs} lines={6}>
        {(data) => <Form {...props} refs={data} />}
      </ResourceView>
    </Panel>
  );
}
