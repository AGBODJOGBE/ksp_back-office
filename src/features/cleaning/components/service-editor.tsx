'use client';

import { type FormEvent, type ReactNode, useCallback, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FormMessage, TextField } from '@/components/ui/field';
import { SelectField, TextAreaField } from '@/components/ui/select-field';
import { ApiError } from '@/lib/api';
import { previewService, saveService, type PreviewInput } from '@/features/cleaning/api';
import { catalogScreenTexts } from '@/features/cleaning/catalog-screen-texts';
import { errorText } from '@/features/cleaning/errors';
import { initialValues, modelFromInput, readValues, type FormValues } from '@/features/cleaning/form-model';
import { measureTexts } from '@/features/cleaning/measure-texts';
import type { Calculation, ServiceDefinition } from '@/features/cleaning/schemas';
import {
  type ChoiceDraft,
  type DraftErrors,
  draftFromService,
  type FieldDraft,
  type FieldType,
  move,
  newChecklistItem,
  newChoice,
  newCommune,
  newField,
  newFrequency,
  newOption,
  readServiceDraft,
  type ServiceDraft,
} from '@/features/cleaning/service-draft';
import { PricePanel } from './price-panel';
import { CheckField, ItemTools } from './catalog-parts';
import { ServiceFields } from './service-fields';
import { useLivePrice } from './use-live-price';

const t = catalogScreenTexts.editor;
const p = catalogScreenTexts.preview;
const tools = { moveUp: t.moveUp, moveDown: t.moveDown, remove: t.remove };
const GROUP = 'rounded-card border-line grid gap-4 border p-3 sm:p-5';
const LEGEND = 'text-ink px-1 text-lg font-semibold';

type Errors = DraftErrors;

/** Section de l'éditeur : titre, phrase d'explication, contenu. */
function Section({ title, lead, children }: { title: string; lead?: string; children: ReactNode }) {
  return (
    <fieldset className={GROUP}>
      <legend className={LEGEND}>{title}</legend>
      {lead ? <p className="text-small text-ink-muted -mt-2">{lead}</p> : null}
      {children}
    </fieldset>
  );
}

function ChoiceRow({
  choice,
  path,
  index,
  count,
  errors,
  onChange,
  onMove,
  onRemove,
}: {
  choice: ChoiceDraft;
  path: string;
  index: number;
  count: number;
  errors: Errors;
  onChange: (choice: ChoiceDraft) => void;
  onMove: (step: -1 | 1) => void;
  onRemove?: () => void;
}) {
  const f = t.field;
  const id = `choix-${choice.key}`;
  return (
    <div className="border-line grid gap-3 border-b pb-3 sm:grid-cols-[minmax(0,1fr)_9rem_9rem] sm:items-start">
      <TextField
        id={`${id}-libelle`}
        label={f.choice}
        value={choice.label}
        maxLength={100}
        error={errors[`${path}.label`]}
        onChange={(event) => onChange({ ...choice, label: event.target.value })}
      />
      <TextField
        id={`${id}-supplement`}
        label={f.supplement}
        inputMode="numeric"
        value={choice.supplement}
        error={errors[`${path}.supplement`]}
        onChange={(event) => onChange({ ...choice, supplement: event.target.value })}
      />
      <TextField
        id={`${id}-effet`}
        label={f.effect}
        value={choice.coefficient}
        error={errors[`${path}.coefficientBp`]}
        onChange={(event) => onChange({ ...choice, coefficient: event.target.value })}
      />
      <div className="flex flex-wrap items-center justify-between gap-2 sm:col-span-3">
        <CheckField
          id={`${id}-actif`}
          label={f.active}
          checked={choice.active}
          onChange={(active) => onChange({ ...choice, active })}
        />
        <ItemTools
          index={index}
          count={count}
          name={choice.label || t.unnamed}
          labels={tools}
          onMove={onMove}
          onRemove={onRemove}
        />
      </div>
    </div>
  );
}

/** Éditeur d'une question : libellé, aide, obligation, puis réglages propres à son type et ses tarifs. */
function FieldEditor({
  field,
  path,
  index,
  count,
  errors,
  onChange,
  onMove,
  onRemove,
}: {
  field: FieldDraft;
  path: string;
  index: number;
  count: number;
  errors: Errors;
  onChange: (field: FieldDraft) => void;
  onMove: (step: -1 | 1) => void;
  onRemove?: () => void;
}) {
  const f = t.field;
  const id = `champ-${field.key}`;
  const set = (patch: Partial<FieldDraft>) => onChange({ ...field, ...patch });
  return (
    <div className="rounded-card border-line bg-surface grid gap-4 border p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex flex-wrap items-center gap-2">
          <Badge tone="brand">{t.types[field.type]}</Badge>
          {!field.code ? <Badge tone="accent">{f.newItem}</Badge> : null}
          {!field.active ? <Badge>{catalogScreenTexts.inactive}</Badge> : null}
        </span>
        <ItemTools
          index={index}
          count={count}
          name={field.label || t.unnamed}
          labels={tools}
          onMove={onMove}
          onRemove={onRemove}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id={`${id}-libelle`}
          label={f.label}
          value={field.label}
          maxLength={100}
          error={errors[`${path}.label`]}
          onChange={(event) => set({ label: event.target.value })}
        />
        <TextField
          id={`${id}-aide`}
          label={f.help}
          value={field.helpText}
          maxLength={300}
          onChange={(event) => set({ helpText: event.target.value })}
        />
      </div>
      <div className="flex flex-wrap gap-x-6">
        {field.type !== 'boolean' ? (
          <CheckField
            id={`${id}-obligatoire`}
            label={f.required}
            checked={field.required}
            onChange={(required) => set({ required })}
          />
        ) : null}
        <CheckField
          id={`${id}-actif`}
          label={f.active}
          checked={field.active}
          onChange={(active) => set({ active })}
        />
      </div>

      {field.type === 'number' ? (
        <div className="grid gap-4 sm:grid-cols-4">
          <TextField
            id={`${id}-unite`}
            label={f.unit}
            hint={f.unitHint}
            value={field.unitLabel}
            maxLength={30}
            error={errors[`${path}.unitLabel`]}
            onChange={(event) => set({ unitLabel: event.target.value })}
          />
          <TextField
            id={`${id}-min`}
            label={f.min}
            inputMode="numeric"
            value={field.min}
            error={errors[`${path}.min`]}
            onChange={(event) => set({ min: event.target.value })}
          />
          <TextField
            id={`${id}-max`}
            label={f.max}
            inputMode="numeric"
            value={field.max}
            error={errors[`${path}.max`]}
            onChange={(event) => set({ max: event.target.value })}
          />
          <TextField
            id={`${id}-prix`}
            label={f.pricePerUnit}
            hint={f.priceHint}
            inputMode="numeric"
            value={field.pricePerUnit}
            error={errors[`${path}.pricePerUnit`]}
            onChange={(event) => set({ pricePerUnit: event.target.value })}
          />
        </div>
      ) : null}

      {field.type === 'choice' ? (
        <div className="grid gap-3">
          <p className="text-ink font-semibold">{f.choices}</p>
          <p className="text-small text-ink-muted">{f.effectHint}</p>
          {errors[`${path}.choices`] ? <FormMessage>{errors[`${path}.choices`]}</FormMessage> : null}
          {field.choices.map((choice, choiceIndex) => (
            <ChoiceRow
              key={choice.key}
              choice={choice}
              path={`${path}.choices[${choiceIndex}]`}
              index={choiceIndex}
              count={field.choices.length}
              errors={errors}
              onChange={(next) =>
                set({ choices: field.choices.map((item, i) => (i === choiceIndex ? next : item)) })
              }
              onMove={(step) => set({ choices: move(field.choices, choiceIndex, step) })}
              onRemove={
                choice.code
                  ? undefined
                  : () => set({ choices: field.choices.filter((_, i) => i !== choiceIndex) })
              }
            />
          ))}
          {field.choices.length < 20 ? (
            <Button
              variant="secondary"
              className="justify-self-start"
              onClick={() => set({ choices: [...field.choices, newChoice()] })}
            >
              {f.addChoice}
            </Button>
          ) : null}
        </div>
      ) : null}

      {field.type === 'boolean' ? (
        <div className="grid gap-2">
          <p className="text-small text-ink-muted">{f.yesHint}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              id={`${id}-supplement-oui`}
              label={f.supplementIfYes}
              inputMode="numeric"
              value={field.supplementIfYes}
              error={errors[`${path}.supplementIfYes`]}
              onChange={(event) => set({ supplementIfYes: event.target.value })}
            />
            <TextField
              id={`${id}-effet-oui`}
              label={f.effectIfYes}
              hint={f.effectHint}
              value={field.coefficientIfYes}
              error={errors[`${path}.coefficientBpIfYes`]}
              onChange={(event) => set({ coefficientIfYes: event.target.value })}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Liste de questions (de la prestation ou d'une option) avec les boutons d'ajout par type. */
function FieldList({
  fields,
  prefix,
  errors,
  onChange,
  max,
}: {
  fields: FieldDraft[];
  prefix: string;
  errors: Errors;
  onChange: (fields: FieldDraft[]) => void;
  max: number;
}) {
  const add = (type: FieldType) => onChange([...fields, newField(type)]);
  return (
    <div className="grid gap-3">
      {fields.map((field, index) => (
        <FieldEditor
          key={field.key}
          field={field}
          path={`${prefix}[${index}]`}
          index={index}
          count={fields.length}
          errors={errors}
          onChange={(next) => onChange(fields.map((item, i) => (i === index ? next : item)))}
          onMove={(step) => onChange(move(fields, index, step))}
          onRemove={field.code ? undefined : () => onChange(fields.filter((_, i) => i !== index))}
        />
      ))}
      {fields.length < max ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => add('number')}>
            {t.addNumber}
          </Button>
          <Button variant="secondary" onClick={() => add('choice')}>
            {t.addChoice}
          </Button>
          <Button variant="secondary" onClick={() => add('boolean')}>
            {t.addBoolean}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Essai de prix en direct : réponses d'exemple saisies comme un client, prix calculé par la gateway avec la
 * prestation telle qu'elle est à l'écran (`POST …/catalog/services/{code}/preview`, rien n'est enregistré).
 */
function PreviewPanel({
  code,
  read,
  communes,
}: {
  code: string;
  read: ReturnType<typeof readServiceDraft>;
  communes: string[];
}) {
  const model = useMemo(() => modelFromInput(read.input), [read.input]);
  const [values, setValues] = useState<FormValues>(() => initialValues(model));
  const [commune, setCommune] = useState(communes[0] ?? 'Cotonou');
  const sample = readValues(model, values, measureTexts.form);
  const valid = !Object.keys(read.errors).length;
  const body: PreviewInput | null =
    valid && !Object.keys(sample.errors).length ? { definition: read.input, commune, ...sample.body } : null;
  const run = useCallback(
    async (input: PreviewInput): Promise<{ calculation: Calculation; covered: boolean }> => {
      const result = await previewService(code, input);
      return { calculation: result.calculation, covered: result.covered };
    },
    [code],
  );
  const live = useLivePrice(run, body, 800);
  const price =
    live.status === 'ready'
      ? { status: 'ready' as const, data: live.data.calculation, last: live.data.calculation }
      : { ...live, last: live.last?.calculation ?? null };
  const covered = live.status === 'ready' ? live.data.covered : true;

  return (
    <section aria-labelledby="essai-prix" className={GROUP}>
      <h3 id="essai-prix" className="text-ink text-lg font-semibold">
        {p.title}
      </h3>
      <p className="text-small text-ink-muted">{p.lead}</p>
      <SelectField
        id="essai-commune"
        label={p.commune}
        value={commune}
        onChange={(event) => setCommune(event.target.value)}
      >
        {(communes.length ? communes : ['Cotonou']).map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </SelectField>
      <ServiceFields
        model={model}
        values={values}
        onChange={setValues}
        errors={Object.fromEntries(
          Object.entries(sample.errors).filter(([, text]) => text !== measureTexts.form.required),
        )}
        idPrefix="essai"
      />
      {!valid ? <p className="text-small text-warning">{p.fixFirst}</p> : null}
      <PricePanel price={price} model={model} covered={covered} />
    </section>
  );
}

/** Erreur de la gateway sur la définition : chemin de la propriété (`fields[0].max`, préfixe `definition.` retiré). */
function serverPath(error: unknown): string | null {
  if (!(error instanceof ApiError) || error.status !== 400) return null;
  const field = error.details.field;
  return typeof field === 'string' ? field.replace(/^definition\./, '') : null;
}

/**
 * Éditeur d'une prestation (ADR-033) : informations, questions, options, fréquences, minimum, communes, taille
 * d'équipe et liste de contrôle, sans aucun code à écrire (codes tirés des libellés). Montants en FCFA entiers,
 * effets en pourcentage. Essai de prix en direct à côté. Enregistrer crée une nouvelle version.
 */
export function ServiceEditor({
  service,
  communes,
  takenCodes,
  onCancel,
  onSaved,
}: {
  service: ServiceDefinition | null;
  communes: string[];
  takenCodes: ReadonlySet<string>;
  onCancel: () => void;
  onSaved: (service: ServiceDefinition) => void;
}) {
  const [draft, setDraft] = useState<ServiceDraft>(() => draftFromService(service));
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<Errors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const read = useMemo(() => readServiceDraft(draft, t.messages, takenCodes), [draft, takenCodes]);
  const errors: Errors = { ...(submitted ? read.errors : {}), ...serverErrors };
  const set = (patch: Partial<ServiceDraft>) => {
    setDraft((previous) => ({ ...previous, ...patch }));
    setServerErrors({});
  };
  const numberFields = draft.fields.filter((field) => field.type === 'number');
  const allCommunes = [
    ...new Set([...communes, ...draft.communes.map((item) => item.commune).filter(Boolean)]),
  ];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setSubmitted(true);
    setMessage(null);
    if (Object.keys(read.errors).length) return setMessage(t.fixErrors);
    setPending(true);
    try {
      onSaved(await saveService(read.code, read.input));
    } catch (error) {
      const path = serverPath(error);
      if (path) setServerErrors({ [path]: errorText(error) });
      setMessage(path ? `${t.fixErrors} ${errorText(error)}` : errorText(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <form noValidate onSubmit={submit} aria-labelledby="editeur-titre" className="grid gap-5">
      <div className="grid gap-1">
        <h2 id="editeur-titre" className="font-display text-h3 text-ink font-semibold">
          {service ? t.titleEdit(service.name) : t.titleNew}
        </h2>
        <p className="text-small text-ink-muted">
          {service ? t.versionNote(service.pricing.version + 1) : t.versionNoteNew}
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem] xl:items-start">
        <div className="grid min-w-0 gap-5">
          <Section title={t.info}>
            <TextField
              id="prestation-nom"
              label={t.name}
              value={draft.name}
              maxLength={100}
              error={errors.name}
              onChange={(event) => set({ name: event.target.value })}
            />
            <TextAreaField
              id="prestation-description"
              label={t.description}
              hint={t.descriptionHint}
              rows={3}
              maxLength={1000}
              value={draft.description}
              onChange={(event) => set({ description: event.target.value })}
            />
            <CheckField
              id="prestation-active"
              label={t.active}
              hint={t.activeHint}
              checked={draft.active}
              onChange={(active) => set({ active })}
            />
          </Section>

          <Section title={t.fields} lead={t.fieldsLead}>
            {errors.fields ? <FormMessage>{errors.fields}</FormMessage> : null}
            <FieldList
              fields={draft.fields}
              prefix="fields"
              errors={errors}
              max={30}
              onChange={(fields) => set({ fields })}
            />
          </Section>

          <Section title={t.options} lead={t.optionsLead}>
            {draft.options.map((option, index) => {
              const path = `options[${index}]`;
              const update = (patch: Partial<typeof option>) =>
                set({
                  options: draft.options.map((item, i) => (i === index ? { ...item, ...patch } : item)),
                });
              return (
                <div
                  key={option.key}
                  className="rounded-card border-line bg-surface grid gap-4 border p-3 sm:p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-ink font-semibold">{option.label || t.unnamed}</span>
                      {!option.active ? <Badge>{catalogScreenTexts.inactive}</Badge> : null}
                    </span>
                    <ItemTools
                      index={index}
                      count={draft.options.length}
                      name={option.label || t.unnamed}
                      labels={tools}
                      onMove={(step) => set({ options: move(draft.options, index, step) })}
                      onRemove={
                        option.code
                          ? undefined
                          : () => set({ options: draft.options.filter((_, i) => i !== index) })
                      }
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextField
                      id={`option-${option.key}-libelle`}
                      label={t.option.label}
                      value={option.label}
                      maxLength={100}
                      error={errors[`${path}.label`]}
                      onChange={(event) => update({ label: event.target.value })}
                    />
                    <TextField
                      id={`option-${option.key}-forfait`}
                      label={t.option.flatPrice}
                      hint={t.option.flatHint}
                      inputMode="numeric"
                      value={option.flatPrice}
                      error={errors[`${path}.flatPrice`]}
                      onChange={(event) => update({ flatPrice: event.target.value })}
                    />
                  </div>
                  <TextField
                    id={`option-${option.key}-description`}
                    label={t.option.description}
                    value={option.description}
                    maxLength={500}
                    onChange={(event) => update({ description: event.target.value })}
                  />
                  <CheckField
                    id={`option-${option.key}-active`}
                    label={t.option.active}
                    checked={option.active}
                    onChange={(active) => update({ active })}
                  />
                  <div className="grid gap-2">
                    <p className="text-ink font-semibold">{t.option.fields}</p>
                    <p className="text-small text-ink-muted">{t.option.fieldsHint}</p>
                    <FieldList
                      fields={option.fields}
                      prefix={`${path}.fields`}
                      errors={errors}
                      max={10}
                      onChange={(fields) => update({ fields })}
                    />
                  </div>
                </div>
              );
            })}
            {draft.options.length < 20 ? (
              <Button
                variant="secondary"
                className="justify-self-start"
                onClick={() => set({ options: [...draft.options, newOption()] })}
              >
                {t.addOption}
              </Button>
            ) : null}
          </Section>

          <Section title={t.frequencies} lead={t.frequenciesLead}>
            {draft.frequencies.map((frequency, index) => {
              const path = `pricing.frequencies[${index}]`;
              const update = (patch: Partial<typeof frequency>) =>
                set({
                  frequencies: draft.frequencies.map((item, i) =>
                    i === index ? { ...item, ...patch } : item,
                  ),
                });
              return (
                <div
                  key={frequency.key}
                  className="border-line grid gap-3 border-b pb-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:items-end"
                >
                  <TextField
                    id={`frequence-${frequency.key}-libelle`}
                    label={t.frequency.label}
                    value={frequency.label}
                    maxLength={100}
                    error={errors[`${path}.label`]}
                    onChange={(event) => update({ label: event.target.value })}
                  />
                  <TextField
                    id={`frequence-${frequency.key}-effet`}
                    label={t.frequency.effect}
                    value={frequency.coefficient}
                    error={errors[`${path}.coefficientBp`]}
                    onChange={(event) => update({ coefficient: event.target.value })}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <CheckField
                      id={`frequence-${frequency.key}-active`}
                      label={t.frequency.active}
                      checked={frequency.active}
                      onChange={(active) => update({ active })}
                    />
                    <ItemTools
                      index={index}
                      count={draft.frequencies.length}
                      name={frequency.label || t.unnamed}
                      labels={tools}
                      onMove={(step) => set({ frequencies: move(draft.frequencies, index, step) })}
                      onRemove={
                        frequency.code
                          ? undefined
                          : () => set({ frequencies: draft.frequencies.filter((_, i) => i !== index) })
                      }
                    />
                  </div>
                </div>
              );
            })}
            {draft.frequencies.length < 10 ? (
              <Button
                variant="secondary"
                className="justify-self-start"
                onClick={() => set({ frequencies: [...draft.frequencies, newFrequency()] })}
              >
                {t.addFrequency}
              </Button>
            ) : null}
          </Section>

          <Section title={t.pricing}>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                id="prestation-minimum"
                label={t.minimumPrice}
                hint={t.minimumHint}
                inputMode="numeric"
                value={draft.minimumPrice}
                error={errors['pricing.minimumPrice']}
                onChange={(event) => set({ minimumPrice: event.target.value })}
              />
              <TextField
                id="prestation-effet-defaut"
                label={t.defaultEffect}
                hint={t.defaultEffectHint}
                value={draft.defaultCoefficient}
                error={errors['pricing.defaultCoefficientBp']}
                onChange={(event) => set({ defaultCoefficient: event.target.value })}
              />
            </div>
            <p className="text-ink font-semibold">{t.communes}</p>
            {draft.communes.map((item, index) => {
              const path = `pricing.communeCoefficients[${index}]`;
              const update = (patch: Partial<typeof item>) =>
                set({
                  communes: draft.communes.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)),
                });
              return (
                <div
                  key={item.key}
                  className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:items-end"
                >
                  <SelectField
                    id={`commune-${item.key}`}
                    label={t.commune}
                    value={item.commune}
                    error={errors[`${path}.commune`]}
                    onChange={(event) => update({ commune: event.target.value })}
                  >
                    <option value="">{t.chooseCommune}</option>
                    {allCommunes.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </SelectField>
                  <TextField
                    id={`commune-${item.key}-effet`}
                    label={t.communeEffect}
                    value={item.coefficient}
                    error={errors[`${path}.coefficientBp`]}
                    onChange={(event) => update({ coefficient: event.target.value })}
                  />
                  <Button
                    variant="danger"
                    size="icon"
                    aria-label={t.remove(item.commune || t.unnamed)}
                    onClick={() => set({ communes: draft.communes.filter((_, i) => i !== index) })}
                  >
                    <span aria-hidden="true">✕</span>
                  </Button>
                </div>
              );
            })}
            <Button
              variant="secondary"
              className="justify-self-start"
              onClick={() => set({ communes: [...draft.communes, newCommune()] })}
            >
              {t.addCommune}
            </Button>
          </Section>

          <Section title={t.team} lead={t.teamLead}>
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                id="equipe-champ"
                label={t.teamField}
                value={draft.teamFieldKey}
                onChange={(event) => set({ teamFieldKey: event.target.value })}
              >
                <option value="">{t.teamNone}</option>
                {numberFields.map((field) => (
                  <option key={field.key} value={field.key}>
                    {field.label || t.unnamed}
                    {field.unitLabel ? ` (${field.unitLabel})` : ''}
                  </option>
                ))}
              </SelectField>
              <TextField
                id="equipe-unites"
                label={t.unitsPerAgent}
                inputMode="numeric"
                value={draft.unitsPerAgent}
                error={errors['pricing.teamSize.unitsPerAgent']}
                onChange={(event) => set({ unitsPerAgent: event.target.value })}
              />
              <TextField
                id="equipe-min"
                label={t.minAgents}
                inputMode="numeric"
                value={draft.minAgents}
                error={errors['pricing.teamSize.minAgents']}
                onChange={(event) => set({ minAgents: event.target.value })}
              />
              <TextField
                id="equipe-max"
                label={t.maxAgents}
                inputMode="numeric"
                value={draft.maxAgents}
                error={errors['pricing.teamSize.maxAgents']}
                onChange={(event) => set({ maxAgents: event.target.value })}
              />
            </div>
            {errors['pricing.teamSize.fieldCode'] ? (
              <FormMessage>{errors['pricing.teamSize.fieldCode']}</FormMessage>
            ) : null}
          </Section>

          <Section title={t.checklist} lead={t.checklistLead}>
            {draft.checklist.map((item, index) => (
              <div key={item.key} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <TextField
                  id={`controle-${item.key}`}
                  label={t.item}
                  value={item.label}
                  maxLength={200}
                  error={errors[`pricing.checklist[${index}].label`]}
                  onChange={(event) =>
                    set({
                      checklist: draft.checklist.map((entry, i) =>
                        i === index ? { ...entry, label: event.target.value } : entry,
                      ),
                    })
                  }
                />
                <ItemTools
                  index={index}
                  count={draft.checklist.length}
                  name={item.label || t.unnamed}
                  labels={tools}
                  onMove={(step) => set({ checklist: move(draft.checklist, index, step) })}
                  onRemove={() => set({ checklist: draft.checklist.filter((_, i) => i !== index) })}
                />
              </div>
            ))}
            <Button
              variant="secondary"
              className="justify-self-start"
              onClick={() => set({ checklist: [...draft.checklist, newChecklistItem()] })}
            >
              {t.addItem}
            </Button>
          </Section>
        </div>

        <div className="xl:sticky xl:top-4">
          <PreviewPanel code={read.code} read={read} communes={communes} />
        </div>
      </div>

      <FormMessage>{message}</FormMessage>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" variant="action" size="lg" aria-busy={pending || undefined} disabled={pending}>
          {pending ? catalogScreenTexts.saving : t.save}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          {t.back}
        </Button>
      </div>
    </form>
  );
}
