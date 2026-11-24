'use client';

import { type FormEvent, useCallback, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import type { TableColumn } from '@/components/ui/responsive-table';
import { TextAreaField } from '@/components/ui/select-field';
import { useResource } from '@/lib/use-resource';
import { createParameter, getParameter, listParameters, updateParameter } from '@/features/cleaning/api';
import { catalogTexts } from '@/features/cleaning/catalog-texts';
import { CODE_PATTERN, codeFromLabel, parseInteger, uniqueCode } from '@/features/cleaning/inputs';
import { cleaningPaths } from '@/features/cleaning/paths';
import type { Parameter, ParameterChoice, ParameterKind } from '@/features/cleaning/schemas';
import { cleaningTexts } from '@/features/cleaning/texts';
import {
  CatalogList,
  changedFields,
  CreatedNotice,
  DetailHeader,
  RowLink,
  useOpenCreated,
} from './catalog-parts';
import { ActivationControl, CheckField, FieldGroup, RowFrame } from './editors';
import {
  ActiveBadge,
  type FieldErrors,
  FormFooter,
  Panel,
  ResourceView,
  useCleaningAccess,
  useFormSubmit,
  useIdempotencyKey,
} from './parts';

const t = catalogTexts.parameters;
const d = catalogTexts.detail;
const c = cleaningTexts.common;
const paths = cleaningPaths.catalog;

const kindLabel = (kind: ParameterKind) => t.kinds[kind];

function detailOf(parameter: Parameter): string {
  if (parameter.kind === 'number') return t.bounds(parameter.min, parameter.max, parameter.unit);
  if (parameter.kind === 'choice') return t.choicesCount(parameter.choices.length);
  return '';
}

const columns: TableColumn<Parameter>[] = [
  {
    key: 'label',
    header: t.columns.label,
    primary: true,
    cell: (row) => (
      <span className="grid gap-0.5">
        <RowLink href={paths.parameter(row.id)}>{row.label}</RowLink>
        <code className="text-small text-ink-muted font-normal">{row.code}</code>
      </span>
    ),
  },
  { key: 'kind', header: t.columns.kind, cell: (row) => kindLabel(row.kind) },
  {
    key: 'detail',
    header: t.columns.detail,
    cell: (row) =>
      [detailOf(row), row.required ? t.requiredShort : t.optionalShort].filter(Boolean).join(' · '),
  },
  { key: 'state', header: t.columns.state, cell: (row) => <ActiveBadge active={row.active} /> },
];

/** Paramètres du catalogue (`GET /admin/cleaning/parameters`, tri par code). */
export function ParametersList() {
  return (
    <CatalogList
      load={listParameters}
      columns={columns}
      caption={t.caption}
      empty={t.empty}
      rowKey={(row) => row.id}
      createHref={paths.newParameter}
      createLabel={t.newTitle}
    />
  );
}

interface ChoiceDraft extends ParameterChoice {
  /** Valeur déjà enregistrée : elle se désactive, elle ne se retire pas. */
  saved: boolean;
}

interface Draft {
  code: string;
  codeEdited: boolean;
  label: string;
  kind: ParameterKind;
  unit: string;
  min: string;
  max: string;
  required: boolean;
  help: string;
  choices: ChoiceDraft[];
}

const EMPTY: Draft = {
  code: '',
  codeEdited: false,
  label: '',
  kind: 'number',
  unit: '',
  min: '',
  max: '',
  required: true,
  help: '',
  choices: [],
};

function draftOf(parameter: Parameter): Draft {
  return {
    code: parameter.code,
    codeEdited: true,
    label: parameter.label,
    kind: parameter.kind,
    unit: parameter.unit ?? '',
    min: parameter.min === null ? '' : String(parameter.min),
    max: parameter.max === null ? '' : String(parameter.max),
    required: parameter.required,
    help: parameter.help ?? '',
    choices: parameter.choices.map((choice) => ({ ...choice, saved: true })),
  };
}

const FIELDS = ['code', 'label', 'kind', 'unit', 'min', 'max', 'choices', 'required', 'help', 'active'];
const BOUND_MAX = 1_000_000;

/** Contrôles locaux ; la gateway reste juge (`CLEANING_VALIDATION_FAILED`, `CLEANING_PARAMETER_IN_USE`). */
function validate(draft: Draft, creating: boolean, current?: Parameter): FieldErrors {
  const errors: FieldErrors = {};
  if (creating && !CODE_PATTERN.test(draft.code)) errors.code = c.invalidCode;
  if (!draft.label.trim()) errors.label = c.required;
  else if (draft.label.trim().length > 100) errors.label = c.tooLong(100);
  if (draft.kind === 'number') {
    if (!draft.unit.trim()) errors.unit = c.required;
    else if (draft.unit.trim().length > 20) errors.unit = c.tooLong(20);
    for (const bound of ['min', 'max'] as const) {
      const raw = draft[bound].trim();
      if (!raw) {
        if (current?.[bound] !== null && current?.[bound] !== undefined) errors[bound] = c.required;
        continue;
      }
      const value = parseInteger(raw);
      if (value === null || value > BOUND_MAX) errors[bound] = c.between(0, BOUND_MAX);
    }
  }
  if (draft.kind === 'choice') {
    if (!draft.choices.length) errors.choices = t.noChoice;
    draft.choices.forEach((choice, index) => {
      const label = choice.label.trim();
      if (!label) errors[`choices[${index}].label`] = c.required;
      else if (label.length > 100) errors[`choices[${index}].label`] = c.tooLong(100);
    });
  }
  if (draft.help.trim().length > 300) errors.help = c.tooLong(300);
  return errors;
}

/** Valeurs de choix → contrat : codes gardés, codes nouveaux tirés du libellé et uniques. */
function choicesBody(choices: readonly ChoiceDraft[]): ParameterChoice[] {
  const taken = choices.filter((choice) => choice.saved).map((choice) => choice.code);
  return choices.map((choice) => {
    if (choice.saved) return { code: choice.code, label: choice.label.trim(), active: choice.active };
    const code = uniqueCode(codeFromLabel(choice.label), taken);
    taken.push(code);
    return { code, label: choice.label.trim(), active: choice.active };
  });
}

function fieldsOf(draft: Draft) {
  const number = draft.kind === 'number';
  const min = parseInteger(draft.min);
  const max = parseInteger(draft.max);
  return {
    label: draft.label.trim(),
    unit: number ? draft.unit.trim() : undefined,
    min: number && min !== null ? min : undefined,
    max: number && max !== null ? max : undefined,
    choices: draft.kind === 'choice' ? choicesBody(draft.choices) : undefined,
    required: draft.required,
    help: draft.help.trim(),
  };
}

function ChoicesEditor({
  choices,
  errors,
  readOnly,
  onChange,
}: {
  choices: ChoiceDraft[];
  errors: FieldErrors;
  readOnly: boolean;
  onChange: (choices: ChoiceDraft[]) => void;
}) {
  const update = (index: number, patch: Partial<ChoiceDraft>) =>
    onChange(choices.map((choice, at) => (at === index ? { ...choice, ...patch } : choice)));
  return (
    <FieldGroup id="parametre-valeurs" legend={t.choices} hint={t.choicesHint} error={errors.choices}>
      {choices.map((choice, index) => {
        const title = t.choiceLabel(index + 1);
        return (
          <RowFrame
            key={`${choice.code}-${index}`}
            id={`parametre-valeur-${index}`}
            title={title}
            error={errors[`choices[${index}]`]}
            onRemove={
              choice.saved || readOnly ? undefined : () => onChange(choices.filter((_, at) => at !== index))
            }
          >
            <TextField
              id={`parametre-valeur-${index}-libelle`}
              label="Libellé"
              value={choice.label}
              maxLength={100}
              readOnly={readOnly}
              error={errors[`choices[${index}].label`]}
              onChange={(event) => update(index, { label: event.target.value })}
            />
            {choice.saved ? (
              <CheckField
                id={`parametre-valeur-${index}-active`}
                label={t.choiceActive}
                checked={choice.active}
                disabled={readOnly}
                onChange={(active) => update(index, { active })}
              />
            ) : null}
          </RowFrame>
        );
      })}
      {readOnly || choices.length >= 30 ? null : (
        <Button
          variant="secondary"
          className="justify-self-start"
          onClick={() => onChange([...choices, { code: '', label: '', active: true, saved: false }])}
        >
          {t.addChoice}
        </Button>
      )}
    </FieldGroup>
  );
}

function ParameterForm({
  current,
  readOnly,
  onSaved,
}: {
  current?: Parameter;
  readOnly: boolean;
  onSaved: (parameter: Parameter, created: boolean) => void;
}) {
  const creating = !current;
  const [draft, setDraft] = useState<Draft>(current ? draftOf(current) : EMPTY);
  const form = useFormSubmit(FIELDS);
  const idempotency = useIdempotencyKey();
  const change = (patch: Partial<Draft>) => setDraft((previous) => ({ ...previous, ...patch }));

  function submit(event: FormEvent) {
    void form.submit(event, validate(draft, creating, current), async () => {
      const fields = fieldsOf(draft);
      try {
        if (current) {
          const body = changedFields(fields, {
            ...current,
            unit: current.unit ?? '',
            help: current.help ?? '',
          });
          const saved = Object.keys(body).length ? await updateParameter(current.id, body) : current;
          setDraft(draftOf(saved));
          onSaved(saved, false);
          return c.saved;
        }
        const help = fields.help || undefined;
        const saved = await createParameter(
          { ...fields, help, code: draft.code, kind: draft.kind },
          idempotency.key(),
        );
        idempotency.settle();
        onSaved(saved, true);
      } catch (error) {
        idempotency.settle(error);
        throw error;
      }
    });
  }

  return (
    <form noValidate onSubmit={submit} className="grid gap-5">
      <TextField
        id="parametre-libelle"
        label={t.label}
        hint={t.labelHint}
        value={draft.label}
        maxLength={100}
        readOnly={readOnly}
        error={form.errors.label}
        onChange={(event) =>
          change({
            label: event.target.value,
            ...(draft.codeEdited ? {} : { code: codeFromLabel(event.target.value) }),
          })
        }
      />
      {creating ? (
        <TextField
          id="parametre-code"
          label={c.code}
          hint={c.codeHint}
          value={draft.code}
          maxLength={50}
          spellCheck={false}
          autoComplete="off"
          error={form.errors.code}
          onChange={(event) => change({ code: event.target.value, codeEdited: true })}
        />
      ) : null}
      <FieldGroup
        id="parametre-nature"
        legend={t.kind}
        hint={creating ? undefined : t.kindFixed}
        error={form.errors.kind}
      >
        <div className="grid gap-2 sm:grid-cols-3">
          {(['number', 'choice', 'boolean'] as const).map((kind) => (
            <label
              key={kind}
              className="rounded-control border-line-control has-[:checked]:border-action has-[:checked]:bg-action-soft flex min-h-11 items-start gap-3 border p-3"
            >
              <input
                type="radio"
                name="parametre-nature"
                value={kind}
                checked={draft.kind === kind}
                disabled={!creating || readOnly}
                onChange={() => change({ kind })}
                className="accent-action mt-1 size-5 shrink-0"
              />
              <span className="grid gap-0.5">
                <span className="text-ink font-semibold">{t.kinds[kind]}</span>
                <span className="text-small text-ink-muted">{t.kindHints[kind]}</span>
              </span>
            </label>
          ))}
        </div>
      </FieldGroup>
      {draft.kind === 'number' ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField
            id="parametre-unite"
            label={t.unit}
            hint={t.unitHint}
            value={draft.unit}
            maxLength={20}
            readOnly={readOnly}
            error={form.errors.unit}
            onChange={(event) => change({ unit: event.target.value })}
          />
          <TextField
            id="parametre-min"
            label={t.min}
            hint={t.boundsHint}
            inputMode="numeric"
            value={draft.min}
            readOnly={readOnly}
            error={form.errors.min}
            onChange={(event) => change({ min: event.target.value })}
          />
          <TextField
            id="parametre-max"
            label={t.max}
            hint={t.boundsHint}
            inputMode="numeric"
            value={draft.max}
            readOnly={readOnly}
            error={form.errors.max}
            onChange={(event) => change({ max: event.target.value })}
          />
        </div>
      ) : null}
      {draft.kind === 'choice' ? (
        <ChoicesEditor
          choices={draft.choices}
          errors={form.errors}
          readOnly={readOnly}
          onChange={(choices) => change({ choices })}
        />
      ) : null}
      <CheckField
        id="parametre-obligatoire"
        label={t.required}
        checked={draft.required}
        disabled={readOnly}
        onChange={(required) => change({ required })}
      />
      <TextAreaField
        id="parametre-aide"
        label={t.help}
        hint={t.helpHint}
        value={draft.help}
        maxLength={300}
        readOnly={readOnly}
        error={form.errors.help}
        onChange={(event) => change({ help: event.target.value })}
      />
      {readOnly ? null : (
        <FormFooter
          pending={form.pending}
          message={form.message}
          success={form.success}
          label={creating ? t.newTitle : c.save}
        />
      )}
    </form>
  );
}

/** Création d'un paramètre (`POST /admin/cleaning/parameters`, clé d'idempotence). */
export function NewParameter() {
  const openCreated = useOpenCreated();
  return (
    <div className="grid gap-6">
      <DetailHeader backHref={paths.parameters} title={t.newTitle} />
      <Panel title={d.summary} id="parametre-formulaire">
        <ParameterForm readOnly={false} onSaved={(parameter) => openCreated(paths.parameter(parameter.id))} />
      </Panel>
    </div>
  );
}

/** Fiche d'un paramètre : modification et activation (`GET`, `PATCH /admin/cleaning/parameters/{id}`). */
export function ParameterDetail({ id }: { id: string }) {
  const access = useCleaningAccess();
  const resource = useResource(useCallback(() => getParameter(id), [id]));
  const canManage = !!access?.['cleaning.catalog.manage'];
  return (
    <ResourceView resource={resource} lines={6}>
      {(parameter) => (
        <div className="grid gap-6">
          <DetailHeader
            backHref={paths.parameters}
            title={parameter.label}
            badges={
              <>
                <Badge tone="brand">{kindLabel(parameter.kind)}</Badge>
                <ActiveBadge active={parameter.active} />
              </>
            }
            updatedAt={parameter.updatedAt}
            updatedByName={parameter.updatedByName}
          />
          <CreatedNotice />
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Panel title={d.edit} id="parametre-formulaire">
              <p className="text-small text-ink-muted">
                {c.code} : <code>{parameter.code}</code>
              </p>
              {canManage ? null : <p className="text-small text-ink-muted">{c.readOnly}</p>}
              <ParameterForm
                key={parameter.id}
                current={parameter}
                readOnly={!canManage}
                onSaved={(saved) => resource.set(saved)}
              />
            </Panel>
            <Panel title={d.activation} id="parametre-activation">
              <ActivationControl
                name={parameter.label}
                active={parameter.active}
                canManage={canManage}
                onChange={async (active) => resource.set(await updateParameter(id, { active }))}
              />
            </Panel>
          </div>
        </div>
      )}
    </ResourceView>
  );
}
