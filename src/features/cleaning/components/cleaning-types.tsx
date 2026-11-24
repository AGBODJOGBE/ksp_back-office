'use client';

import { type FormEvent, useCallback, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { TextField } from '@/components/ui/field';
import type { TableColumn } from '@/components/ui/responsive-table';
import { SelectField, TextAreaField } from '@/components/ui/select-field';
import { formatDuration } from '@/lib/format';
import { useResource } from '@/lib/use-resource';
import {
  allCleaningTypes,
  allSkills,
  createCleaningType,
  getCleaningType,
  listCleaningTypes,
  updateCleaningType,
} from '@/features/cleaning/api';
import { catalogTexts } from '@/features/cleaning/catalog-texts';
import { CODE_PATTERN, codeFromLabel, optionalText, parseInteger } from '@/features/cleaning/inputs';
import { cleaningPaths } from '@/features/cleaning/paths';
import type { CleaningType, Skill } from '@/features/cleaning/schemas';
import { cleaningTexts } from '@/features/cleaning/texts';
import {
  CatalogList,
  changedFields,
  CreatedNotice,
  DetailHeader,
  RowLink,
  useOpenCreated,
} from './catalog-parts';
import {
  ActivationControl,
  CheckField,
  checklistBody,
  checklistDraft,
  type ChecklistDraft,
  ChecklistEditor,
  checklistErrors,
  OrderedPicker,
} from './editors';
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

const t = catalogTexts.types;
const d = catalogTexts.detail;
const c = cleaningTexts.common;
const paths = cleaningPaths.catalog;

const columns: TableColumn<CleaningType>[] = [
  {
    key: 'name',
    header: t.columns.name,
    primary: true,
    cell: (row) => <RowLink href={paths.type(row.id)}>{row.name}</RowLink>,
  },
  { key: 'kind', header: t.columns.kind, cell: (row) => (row.isPack ? t.kindPack : t.kindSingle) },
  {
    key: 'duration',
    header: t.columns.duration,
    className: 'tabular-nums',
    cell: (row) => formatDuration(row.referenceDurationMinutes),
  },
  { key: 'skill', header: t.columns.skill, cell: (row) => row.requiredSkillCode ?? c.none },
  { key: 'state', header: t.columns.state, cell: (row) => <ActiveBadge active={row.active} /> },
];

/** Types de nettoyage et packs (`GET /admin/cleaning/cleaning-types`, tri par nom). */
export function CleaningTypesList() {
  return (
    <CatalogList
      load={listCleaningTypes}
      columns={columns}
      caption={t.caption}
      empty={t.empty}
      rowKey={(row) => row.id}
      createHref={paths.newType}
      createLabel={t.newTitle}
    />
  );
}

async function loadChoices() {
  const [skills, types] = await Promise.all([allSkills(), allCleaningTypes()]);
  return { skills, types };
}
type Choices = Awaited<ReturnType<typeof loadChoices>>;

interface Draft {
  code: string;
  codeEdited: boolean;
  name: string;
  description: string;
  icon: string;
  requiredSkillCode: string;
  duration: string;
  isPack: boolean;
  packItemIds: string[];
  checklist: ChecklistDraft[];
}

const FIELDS = [
  'code',
  'name',
  'description',
  'icon',
  'requiredSkillCode',
  'referenceDurationMinutes',
  'isPack',
  'packItemIds',
  'checklist',
];

function draftOf(type?: CleaningType): Draft {
  return {
    code: type?.code ?? '',
    codeEdited: !!type,
    name: type?.name ?? '',
    description: type?.description ?? '',
    icon: type?.icon ?? '',
    requiredSkillCode: type?.requiredSkillCode ?? '',
    duration: type ? String(type.referenceDurationMinutes) : '',
    isPack: type?.isPack ?? false,
    packItemIds: type?.packItemIds ?? [],
    checklist: checklistDraft(type?.checklist ?? []),
  };
}

function validate(draft: Draft, current?: CleaningType): FieldErrors {
  const errors: FieldErrors = { ...checklistErrors(draft.checklist, 'checklist') };
  if (!current && !CODE_PATTERN.test(draft.code)) errors.code = c.invalidCode;
  if (!draft.name.trim()) errors.name = c.required;
  else if (draft.name.trim().length > 100) errors.name = c.tooLong(100);
  if (draft.description.trim().length > 1000) errors.description = c.tooLong(1000);
  if (draft.icon.trim().length > 50) errors.icon = c.tooLong(50);
  const duration = parseInteger(draft.duration);
  if (duration === null || duration < 1 || duration > 1440)
    errors.referenceDurationMinutes = c.between(1, 1440);
  if (draft.isPack && !draft.packItemIds.length) errors.packItemIds = t.noPackItem;
  return errors;
}

function TypeForm({
  current,
  choices,
  readOnly,
  onSaved,
}: {
  current?: CleaningType;
  choices: Choices;
  readOnly: boolean;
  onSaved: (type: CleaningType) => void;
}) {
  const [draft, setDraft] = useState<Draft>(draftOf(current));
  const form = useFormSubmit(FIELDS);
  const idempotency = useIdempotencyKey();
  const change = (patch: Partial<Draft>) => setDraft((previous) => ({ ...previous, ...patch }));

  function submit(event: FormEvent) {
    void form.submit(event, validate(draft, current), async () => {
      const fields = {
        name: draft.name.trim(),
        description: draft.description.trim(),
        icon: draft.icon.trim(),
        // Un pack n'exige pas de compétence propre (celles de ses types).
        requiredSkillCode: draft.isPack ? undefined : draft.requiredSkillCode || undefined,
        referenceDurationMinutes: parseInteger(draft.duration) ?? 0,
        checklist: checklistBody(draft.checklist),
        isPack: draft.isPack,
        packItemIds: draft.isPack ? draft.packItemIds : [],
      };
      try {
        if (current) {
          const body = changedFields(fields, {
            ...current,
            description: current.description ?? '',
            icon: current.icon ?? '',
          });
          const saved = Object.keys(body).length ? await updateCleaningType(current.id, body) : current;
          setDraft(draftOf(saved));
          onSaved(saved);
          return c.saved;
        }
        const saved = await createCleaningType(
          {
            ...fields,
            code: draft.code,
            description: optionalText(draft.description),
            icon: optionalText(draft.icon),
          },
          idempotency.key(),
        );
        idempotency.settle();
        onSaved(saved);
      } catch (error) {
        idempotency.settle(error);
        throw error;
      }
    });
  }

  const packOptions = choices.types
    .filter((type) => !type.isPack && type.id !== current?.id)
    .map((type) => ({
      id: type.id,
      label: type.name,
      detail: type.active ? undefined : c.inactive,
      disabled: !type.active,
    }));

  return (
    <form noValidate onSubmit={submit} className="grid gap-5">
      <TextField
        id="type-nom"
        label={t.name}
        value={draft.name}
        maxLength={100}
        readOnly={readOnly}
        error={form.errors.name}
        onChange={(event) =>
          change({
            name: event.target.value,
            ...(draft.codeEdited ? {} : { code: codeFromLabel(event.target.value) }),
          })
        }
      />
      {current ? null : (
        <TextField
          id="type-code"
          label={c.code}
          hint={c.codeHint}
          value={draft.code}
          maxLength={50}
          spellCheck={false}
          autoComplete="off"
          error={form.errors.code}
          onChange={(event) => change({ code: event.target.value, codeEdited: true })}
        />
      )}
      <TextAreaField
        id="type-description"
        label={t.description}
        hint={t.descriptionHint}
        value={draft.description}
        maxLength={1000}
        readOnly={readOnly}
        error={form.errors.description}
        onChange={(event) => change({ description: event.target.value })}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="type-duree"
          label={t.duration}
          hint={t.durationHint}
          inputMode="numeric"
          value={draft.duration}
          readOnly={readOnly}
          error={form.errors.referenceDurationMinutes}
          onChange={(event) => change({ duration: event.target.value })}
        />
        <TextField
          id="type-icone"
          label={t.icon}
          hint={t.iconHint}
          value={draft.icon}
          maxLength={50}
          readOnly={readOnly}
          error={form.errors.icon}
          onChange={(event) => change({ icon: event.target.value })}
        />
      </div>
      <CheckField
        id="type-pack"
        label={t.pack}
        hint={t.packHint}
        checked={draft.isPack}
        disabled={readOnly}
        onChange={(isPack) => change({ isPack })}
      />
      {draft.isPack ? (
        <OrderedPicker
          id="type-pack-types"
          legend={t.packItems}
          hint={t.packItemsHint}
          options={packOptions}
          value={draft.packItemIds}
          onChange={
            readOnly ? () => undefined : (packItemIds) => change({ packItemIds: packItemIds.slice(0, 20) })
          }
          error={form.errors.packItemIds}
          empty={t.empty}
          ordered={false}
        />
      ) : (
        <SelectField
          id="type-competence"
          label={t.skill}
          hint={t.skillHint}
          value={draft.requiredSkillCode}
          disabled={readOnly}
          error={form.errors.requiredSkillCode}
          onChange={(event) => change({ requiredSkillCode: event.target.value })}
          className="max-w-md"
        >
          <option value="">{t.noSkill}</option>
          {choices.skills.map((skill: Skill) => (
            <option key={skill.id} value={skill.code}>
              {skill.name}
              {skill.active ? '' : ` (${c.inactiveFeminine.toLowerCase()})`}
            </option>
          ))}
        </SelectField>
      )}
      <ChecklistEditor
        id="type-controle"
        field="checklist"
        legend={t.checklist}
        hint={t.checklistHint}
        items={draft.checklist}
        onChange={(checklist) => change({ checklist })}
        errors={form.errors}
        readOnly={readOnly}
      />
      {readOnly ? null : (
        <FormFooter
          pending={form.pending}
          message={form.message}
          success={form.success}
          label={current ? c.save : t.newTitle}
        />
      )}
    </form>
  );
}

/** Création d'un type de nettoyage ou d'un pack (`POST /admin/cleaning/cleaning-types`). */
export function NewCleaningType() {
  const openCreated = useOpenCreated();
  const choices = useResource(loadChoices);
  return (
    <div className="grid gap-6">
      <DetailHeader backHref={paths.types} title={t.newTitle} />
      <Panel title={d.summary} id="type-formulaire">
        <ResourceView resource={choices} lines={6}>
          {(data) => (
            <TypeForm choices={data} readOnly={false} onSaved={(type) => openCreated(paths.type(type.id))} />
          )}
        </ResourceView>
      </Panel>
    </div>
  );
}

/** Fiche d'un type de nettoyage : modification et activation. */
export function CleaningTypeDetail({ id }: { id: string }) {
  const access = useCleaningAccess();
  const resource = useResource(
    useCallback(async () => {
      const [type, choices] = await Promise.all([getCleaningType(id), loadChoices()]);
      return { type, choices };
    }, [id]),
  );
  const canManage = !!access?.['cleaning.catalog.manage'];
  return (
    <ResourceView resource={resource} lines={8}>
      {({ type, choices }) => {
        const setType = (saved: CleaningType) => resource.set({ type: saved, choices });
        return (
          <div className="grid gap-6">
            <DetailHeader
              backHref={paths.types}
              title={type.name}
              badges={
                <>
                  {type.isPack ? <Badge tone="brand">{t.kindPack}</Badge> : null}
                  <ActiveBadge active={type.active} />
                </>
              }
              updatedAt={type.updatedAt}
              updatedByName={type.updatedByName}
            />
            <CreatedNotice />
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <Panel title={d.edit} id="type-formulaire">
                <p className="text-small text-ink-muted">
                  {c.code} : <code>{type.code}</code>
                </p>
                {canManage ? null : <p className="text-small text-ink-muted">{c.readOnly}</p>}
                <TypeForm
                  key={type.id}
                  current={type}
                  choices={choices}
                  readOnly={!canManage}
                  onSaved={setType}
                />
              </Panel>
              <Panel title={d.activation} id="type-activation">
                <ActivationControl
                  name={type.name}
                  active={type.active}
                  canManage={canManage}
                  onChange={async (active) => setType(await updateCleaningType(id, { active }))}
                />
              </Panel>
            </div>
          </div>
        );
      }}
    </ResourceView>
  );
}
