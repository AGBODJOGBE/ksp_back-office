'use client';

import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { FieldError, fieldIds, inputClasses } from '@/components/ui/field';
import { cn } from '@/lib/cn';
import {
  answerKey,
  type FieldValue,
  type FormErrors,
  type FormModel,
  type FormValues,
  type ModelField,
} from '@/features/cleaning/form-model';
import { measureTexts } from '@/features/cleaning/measure-texts';

const t = measureTexts.form;

/** Identifiant HTML d'un champ à partir de sa clé (`answers.rooms` → `prefixe-answers-rooms`). */
const domId = (prefix: string, key: string) => `${prefix}-${key.replace(/[^a-z0-9_-]/gi, '-')}`;

interface Annotations {
  /** Rappel sous un champ (« Déclaré par le client : 6 pièces »), par clé. */
  declared?: Record<string, string>;
  /** Clés dont la saisie diffère de la source : badge « Modifié ». */
  changed?: ReadonlySet<string>;
}

function Legend({
  field,
  marker,
}: {
  field: Pick<ModelField, 'label' | 'required' | 'unitLabel'>;
  marker?: ReactNode;
}) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span>
        {field.label}
        {field.unitLabel ? ` (${field.unitLabel})` : ''}
        {field.required ? <span className="text-ink-muted font-normal"> {t.requiredMark}</span> : null}
      </span>
      {marker}
    </span>
  );
}

function Hints({ id, lines }: { id: string; lines: Array<string | null | undefined> }) {
  const shown = lines.filter(Boolean);
  if (!shown.length) return null;
  return (
    <p id={id} className="text-small text-ink-muted mt-1 grid">
      {shown.map((line) => (
        <span key={line}>{line}</span>
      ))}
    </p>
  );
}

function Field({
  field,
  value,
  fieldKey,
  prefix,
  error,
  disabled,
  annotations,
  onChange,
}: {
  field: ModelField;
  value: FieldValue | undefined;
  fieldKey: string;
  prefix: string;
  error?: string;
  disabled: boolean;
  annotations: Annotations;
  onChange: (value: FieldValue) => void;
}) {
  const id = domId(prefix, fieldKey);
  const ids = fieldIds(id);
  const declared = annotations.declared?.[fieldKey];
  const marker = annotations.changed?.has(fieldKey) ? <Badge tone="warning">{t.changed}</Badge> : null;
  const hints = [
    field.helpText,
    field.type === 'number' ? t.bounds(field.min, field.max) : null,
    annotations.declared ? (declared ? t.declared(declared) : t.declaredNone) : null,
  ];
  const hasHint = hints.some(Boolean);
  const describedBy = cn(hasHint && ids.hint, error && ids.error) || undefined;
  const text = typeof value === 'string' ? value : '';

  if (field.type === 'boolean') {
    return (
      <div className="grid gap-1">
        <label className="flex min-h-11 items-center gap-3 font-semibold">
          <input
            id={id}
            type="checkbox"
            className="accent-brand size-5"
            checked={value === true}
            disabled={disabled}
            aria-describedby={describedBy}
            onChange={(event) => onChange(event.target.checked)}
          />
          <Legend field={{ ...field, required: false }} marker={marker} />
          <span className="text-ink-muted font-normal">({t.yes})</span>
        </label>
        <Hints id={ids.hint} lines={hints} />
        {error ? <FieldError id={ids.error}>{error}</FieldError> : null}
      </div>
    );
  }

  if (field.type === 'choice' && field.choices.length <= 4) {
    return (
      <fieldset aria-describedby={describedBy} aria-invalid={error ? true : undefined} className="grid gap-1">
        <legend className="text-ink font-semibold">
          <Legend field={field} marker={marker} />
        </legend>
        <Hints id={ids.hint} lines={hints} />
        <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1">
          {field.choices.map((choice) => (
            <label key={choice.code} className="flex min-h-11 items-center gap-2">
              <input
                type="radio"
                name={id}
                value={choice.code}
                className="accent-brand size-5"
                checked={text === choice.code}
                disabled={disabled}
                onChange={() => onChange(choice.code)}
              />
              {choice.label}
            </label>
          ))}
        </div>
        {error ? <FieldError id={ids.error}>{error}</FieldError> : null}
      </fieldset>
    );
  }

  return (
    <div>
      <label htmlFor={id} className="text-ink block font-semibold">
        <Legend field={field} marker={marker} />
      </label>
      <Hints id={ids.hint} lines={hints} />
      {field.type === 'choice' ? (
        <select
          id={id}
          value={text}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={inputClasses({ invalid: !!error, className: 'mt-2 pr-10' })}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">{t.choose}</option>
          {field.choices.map((choice) => (
            <option key={choice.code} value={choice.code}>
              {choice.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          inputMode="numeric"
          value={text}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={inputClasses({ invalid: !!error, className: 'mt-2 sm:max-w-xs' })}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {error ? <FieldError id={ids.error}>{error}</FieldError> : null}
    </div>
  );
}

/**
 * Formulaire d'une prestation construit depuis sa définition : nombres (unité, bornes), choix (boutons radio
 * jusqu'à 4 valeurs, liste au-delà), oui/non, options (cochées, avec leurs questions), fréquence. Les erreurs
 * s'affichent sous le champ visé (clés de `form-model`).
 */
export function ServiceFields({
  model,
  values,
  onChange,
  errors = {},
  disabled = false,
  idPrefix,
  declared,
  changed,
}: {
  model: FormModel;
  values: FormValues;
  onChange: (values: FormValues) => void;
  errors?: FormErrors;
  disabled?: boolean;
  idPrefix: string;
} & Annotations) {
  const annotations = { declared, changed };
  const setAnswer = (code: string, value: FieldValue) =>
    onChange({ ...values, answers: { ...values.answers, [code]: value } });
  const setOption = (code: string, patch: Partial<FormValues['options'][string]>) => {
    const current = values.options[code] ?? { checked: false, answers: {} };
    onChange({ ...values, options: { ...values.options, [code]: { ...current, ...patch } } });
  };
  const frequencyKey = 'frequency';
  const frequencyId = domId(idPrefix, frequencyKey);

  return (
    <div className="grid gap-5">
      {model.fields.map((field) => (
        <Field
          key={field.code}
          field={field}
          fieldKey={answerKey(field.code)}
          value={values.answers[field.code]}
          prefix={idPrefix}
          error={errors[answerKey(field.code)]}
          disabled={disabled}
          annotations={annotations}
          onChange={(value) => setAnswer(field.code, value)}
        />
      ))}

      {model.options.length ? (
        <fieldset className="rounded-card border-line grid gap-3 border p-3 sm:p-4">
          <legend className="text-ink px-1 font-semibold">{t.options}</legend>
          <p className="text-small text-ink-muted">{t.optionHint}</p>
          {errors.options ? (
            <FieldError id={domId(idPrefix, 'options-erreur')}>{errors.options}</FieldError>
          ) : null}
          {model.options.map((option) => {
            const state = values.options[option.code];
            const key = `options.${option.code}`;
            const declaredOption = declared
              ? declared[key]
                ? measureTexts.measures.chosen
                : measureTexts.measures.notChosen
              : null;
            return (
              <div key={option.code} className="grid gap-3">
                <label className="flex min-h-11 items-center gap-3">
                  <input
                    type="checkbox"
                    className="accent-brand size-5"
                    checked={!!state?.checked}
                    disabled={disabled}
                    onChange={(event) => setOption(option.code, { checked: event.target.checked })}
                  />
                  <span className="grid">
                    <span className="flex flex-wrap items-center gap-2 font-semibold">
                      {option.label}
                      {changed?.has(key) ? <Badge tone="warning">{t.changed}</Badge> : null}
                    </span>
                    {option.description ? (
                      <span className="text-small text-ink-muted">{option.description}</span>
                    ) : null}
                    {declaredOption ? (
                      <span className="text-small text-ink-muted">{t.declared(declaredOption)}</span>
                    ) : null}
                  </span>
                </label>
                {state?.checked && option.fields.length ? (
                  <div className="border-line grid gap-4 border-l-2 pl-4">
                    {option.fields.map((field) => {
                      const fieldKey = answerKey(field.code, option.code);
                      return (
                        <Field
                          key={field.code}
                          field={field}
                          fieldKey={fieldKey}
                          value={state.answers[field.code]}
                          prefix={idPrefix}
                          error={errors[fieldKey]}
                          disabled={disabled}
                          annotations={annotations}
                          onChange={(value) =>
                            setOption(option.code, { answers: { ...state.answers, [field.code]: value } })
                          }
                        />
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </fieldset>
      ) : null}

      {model.frequencies.length ? (
        <div>
          <label htmlFor={frequencyId} className="text-ink block font-semibold">
            <span className="flex flex-wrap items-center gap-2">
              {t.frequency} <span className="text-ink-muted font-normal">{t.requiredMark}</span>
              {changed?.has(frequencyKey) ? <Badge tone="warning">{t.changed}</Badge> : null}
            </span>
          </label>
          {declared ? (
            <p id={fieldIds(frequencyId).hint} className="text-small text-ink-muted mt-1">
              {declared.frequency ? t.declared(declared.frequency) : t.declaredNone}
            </p>
          ) : null}
          <select
            id={frequencyId}
            value={values.frequency}
            disabled={disabled}
            aria-invalid={errors.frequency ? true : undefined}
            aria-describedby={
              cn(declared && fieldIds(frequencyId).hint, errors.frequency && fieldIds(frequencyId).error) ||
              undefined
            }
            className={inputClasses({ invalid: !!errors.frequency, className: 'mt-2 pr-10 sm:max-w-xs' })}
            onChange={(event) => onChange({ ...values, frequency: event.target.value })}
          >
            <option value="">{t.choose}</option>
            {model.frequencies.map((frequency) => (
              <option key={frequency.code} value={frequency.code}>
                {frequency.label}
              </option>
            ))}
          </select>
          {errors.frequency ? (
            <FieldError id={fieldIds(frequencyId).error}>{errors.frequency}</FieldError>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
