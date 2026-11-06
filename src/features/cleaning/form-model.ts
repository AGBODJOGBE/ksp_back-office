import { ApiError } from '@/lib/api';
import type { MeasurementInput, ServiceInput } from './api';
import type { AnswerSummary, Answers, OptionSelection, ServiceForm } from './schemas';

/*
 * Formulaire d'une prestation construit depuis sa définition (formulaire public, ou brouillon du catalogue) :
 * mesures constatées après la visite (ADR-037) et réponses d'exemple de l'essai de prix (ADR-033). Logique
 * d'affichage seulement : la gateway valide les réponses et calcule les prix.
 */

export interface ModelField {
  code: string;
  label: string;
  type: string;
  required: boolean;
  helpText: string | null;
  unitLabel: string | null;
  min: number | null;
  max: number | null;
  choices: Array<{ code: string; label: string }>;
}

export interface FormModel {
  fields: ModelField[];
  options: Array<{ code: string; label: string; description: string | null; fields: ModelField[] }>;
  frequencies: Array<{ code: string; label: string }>;
}

type PublicField = ServiceForm['fields'][number];

const publicField = (field: PublicField): ModelField => ({
  code: field.code,
  label: field.label,
  type: field.type,
  required: field.required ?? false,
  helpText: field.helpText ?? null,
  unitLabel: field.unitLabel,
  min: field.min ?? null,
  max: field.max ?? null,
  choices: field.choices,
});

/** Formulaire public d'une prestation (`GET /cleaning/services` → `form`) : éléments actifs, dans l'ordre. */
export function modelFromPublicForm(form: ServiceForm): FormModel {
  return {
    fields: form.fields.map(publicField),
    options: form.options.map((option) => ({
      code: option.code,
      label: option.label,
      description: option.description ?? null,
      fields: option.fields.map(publicField),
    })),
    frequencies: form.frequencies,
  };
}

type InputField = ServiceInput['fields'][number];

const inputField = (field: InputField): ModelField => ({
  code: field.code,
  label: field.label,
  type: field.type,
  required: field.required,
  helpText: field.helpText ?? null,
  unitLabel: field.type === 'number' ? field.unitLabel : null,
  min: field.type === 'number' ? field.min : null,
  max: field.type === 'number' ? field.max : null,
  choices:
    field.type === 'choice'
      ? field.choices.filter((c) => c.active).map(({ code, label }) => ({ code, label }))
      : [],
});

/** Formulaire tel que le client le verrait avec une définition du catalogue (éléments actifs seulement). */
export function modelFromInput(input: ServiceInput): FormModel {
  return {
    fields: input.fields.filter((field) => field.active).map(inputField),
    options: (input.options ?? [])
      .filter((option) => option.active)
      .map((option) => ({
        code: option.code,
        label: option.label,
        description: option.description ?? null,
        fields: (option.fields ?? []).filter((field) => field.active).map(inputField),
      })),
    frequencies: (input.pricing.frequencies ?? [])
      .filter((frequency) => frequency.active)
      .map(({ code, label }) => ({ code, label })),
  };
}

/** Saisie d'un champ : texte pour un nombre ou un choix, case pour un oui/non. */
export type FieldValue = string | boolean;

export interface FormValues {
  answers: Record<string, FieldValue>;
  options: Record<string, { checked: boolean; answers: Record<string, FieldValue> }>;
  frequency: string;
}

/** Réponses de départ : celles du client, ou les mesures déjà saisies. */
export interface AnswerSource {
  answers: Answers | null;
  options: readonly OptionSelection[];
  frequency: string | null;
}

function fieldValues(fields: readonly ModelField[], answers: Answers | undefined | null) {
  return Object.fromEntries(
    fields.map((field) => {
      const value = answers?.[field.code];
      if (field.type === 'boolean') return [field.code, value === true];
      return [field.code, value === undefined || typeof value === 'boolean' ? '' : String(value)];
    }),
  );
}

/** Valeurs du formulaire préremplies avec une source (sinon vides ; « Non » pour un oui/non). */
export function initialValues(model: FormModel, source?: AnswerSource | null): FormValues {
  const frequency =
    source?.frequency && model.frequencies.some((f) => f.code === source.frequency)
      ? source.frequency
      : model.frequencies.length === 1
        ? (model.frequencies[0]?.code ?? '')
        : '';
  return {
    answers: fieldValues(model.fields, source?.answers),
    options: Object.fromEntries(
      model.options.map((option) => {
        const chosen = source?.options.find((selection) => selection.code === option.code);
        return [option.code, { checked: !!chosen, answers: fieldValues(option.fields, chosen?.answers) }];
      }),
    ),
    frequency,
  };
}

/** Messages des contrôles locaux (avant tout appel). */
export interface FormMessages {
  required: string;
  integer: string;
  range: (min: number | null, max: number | null) => string;
}

export type FormErrors = Record<string, string>;

/** Clé d'erreur d'un champ du formulaire : `answers.<champ>`, `options.<option>.answers.<champ>`, `frequency`. */
export const answerKey = (code: string, option?: string) =>
  option ? `options.${option}.answers.${code}` : `answers.${code}`;

function readFields(
  fields: readonly ModelField[],
  values: Record<string, FieldValue>,
  option: string | undefined,
  messages: FormMessages,
  errors: FormErrors,
): Answers {
  const answers: Answers = {};
  for (const field of fields) {
    const value = values[field.code];
    const key = answerKey(field.code, option);
    if (field.type === 'boolean') {
      answers[field.code] = value === true;
      continue;
    }
    const text = typeof value === 'string' ? value.trim() : '';
    if (!text) {
      if (field.required) errors[key] = messages.required;
      continue;
    }
    if (field.type === 'number') {
      if (!/^\d+$/.test(text)) {
        errors[key] = messages.integer;
        continue;
      }
      const number = Number(text);
      if ((field.min !== null && number < field.min) || (field.max !== null && number > field.max)) {
        errors[key] = messages.range(field.min, field.max);
        continue;
      }
      answers[field.code] = number;
    } else {
      answers[field.code] = text;
    }
  }
  return answers;
}

/**
 * Corps à envoyer (`CleaningMeasurementInput`) : champs facultatifs vides omis, une entrée par option cochée,
 * fréquence obligatoire si la prestation en propose. Les erreurs locales (obligatoire, entier, bornes) évitent
 * un appel voué au refus ; la gateway reste seule juge.
 */
export function readValues(
  model: FormModel,
  values: FormValues,
  messages: FormMessages,
): { body: MeasurementInput; errors: FormErrors } {
  const errors: FormErrors = {};
  const answers = readFields(model.fields, values.answers, undefined, messages, errors);
  const options = model.options
    .filter((option) => values.options[option.code]?.checked)
    .map((option) => ({
      code: option.code,
      answers: readFields(
        option.fields,
        values.options[option.code]?.answers ?? {},
        option.code,
        messages,
        errors,
      ),
    }));
  const body: MeasurementInput = { answers };
  if (options.length) body.options = options;
  if (model.frequencies.length) {
    if (values.frequency) body.frequency = values.frequency;
    else errors.frequency = messages.required;
  }
  return { body, errors };
}

/**
 * Clé du formulaire visée par une erreur de la gateway (`details.field`) : préfixe des mesures retiré
 * (`measurements.`, `measurements[0].`), position d'une option remplacée par son code d'après le corps envoyé.
 */
export function errorKey(field: string, body: MeasurementInput): string | null {
  const path = field.replace(/^measurements(\[\d+\])?\./, '');
  if (path === 'frequency') return 'frequency';
  if (/^answers\.[a-z][a-z0-9_]*$/.test(path)) return path;
  const option = /^options\[(\d+)\](?:\.(answers\.[a-z][a-z0-9_]*))?/.exec(path);
  if (option) {
    const code = body.options?.[Number(option[1])]?.code;
    if (!code) return 'options';
    return option[2] ? `options.${code}.${option[2]}` : 'options';
  }
  return path.startsWith('options') ? 'options' : null;
}

/** Erreur de validation de la gateway sous le bon champ : `{ key, message }`, ou `null` si elle n'en vise aucun. */
export function fieldError(error: unknown, body: MeasurementInput): { key: string; message: string } | null {
  if (!(error instanceof ApiError) || error.status !== 400) return null;
  const field = error.details.field;
  if (typeof field !== 'string') return null;
  const key = errorKey(field, body);
  return key ? { key, message: error.message } : null;
}

const sameValue = (a: unknown, b: unknown) => (a ?? null) === (b ?? null);

/**
 * Champs dont la saisie diffère de la source (réponses du client) : mis en évidence dans le formulaire.
 * Clés comme `answerKey` ; `options.<option>` pour une option cochée ou décochée ; `frequency`.
 */
export function changedKeys(model: FormModel, values: FormValues, source: AnswerSource): Set<string> {
  const changed = new Set<string>();
  const compare = (
    fields: readonly ModelField[],
    current: Record<string, FieldValue>,
    from: Answers,
    option?: string,
  ) => {
    for (const field of fields) {
      const value = current[field.code];
      const typed =
        field.type === 'boolean'
          ? value === true
          : typeof value === 'string' && value.trim()
            ? field.type === 'number' && /^\d+$/.test(value.trim())
              ? Number(value.trim())
              : value.trim()
            : null;
      const original = field.type === 'boolean' ? from[field.code] === true : from[field.code];
      if (!sameValue(typed, original)) changed.add(answerKey(field.code, option));
    }
  };
  compare(model.fields, values.answers, source.answers ?? {});
  for (const option of model.options) {
    const chosen = source.options.find((selection) => selection.code === option.code);
    const current = values.options[option.code];
    if (!!current?.checked !== !!chosen) changed.add(`options.${option.code}`);
    if (current?.checked && chosen) compare(option.fields, current.answers, chosen.answers, option.code);
  }
  if (model.frequencies.length && !sameValue(values.frequency || null, source.frequency)) {
    changed.add('frequency');
  }
  return changed;
}

/** Réponses lisibles du client, par clé du formulaire (`answerKey`, `frequency`) : rappel sous chaque champ. */
export function summaryDisplays(summary: AnswerSummary): Record<string, string> {
  const displays: Record<string, string> = {};
  for (const field of summary.fields) displays[answerKey(field.code)] = field.display;
  for (const option of summary.options) {
    displays[`options.${option.optionCode}`] = option.label;
    for (const field of option.fields) displays[answerKey(field.code, option.optionCode)] = field.display;
  }
  if (summary.frequency) displays.frequency = summary.frequency.label;
  return displays;
}

/** Ligne de la comparaison « Déclaré par le client » / « Constaté ». */
export interface ComparisonRow {
  key: string;
  label: string;
  declared: string | null;
  measured: string | null;
  changed: boolean;
}

/**
 * Compare les réponses lisibles du client et les mesures constatées (`answerSummary`, `measuredSummary`) : une
 * ligne par champ, par option (choisie ou non, puis ses champs) et pour la fréquence, dans l'ordre du client
 * puis les ajouts des mesures. `changed` signale un écart.
 */
export function compareSummaries(
  declared: AnswerSummary | null,
  measured: AnswerSummary,
  labels: { chosen: string; notChosen: string; frequency: string; option: (label: string) => string },
): ComparisonRow[] {
  const rows: ComparisonRow[] = [];
  const push = (key: string, label: string, a: string | null, b: string | null) =>
    rows.push({ key, label, declared: a, measured: b, changed: a !== b });

  const fieldRows = (
    a: AnswerSummary['fields'],
    b: AnswerSummary['fields'],
    prefix: (code: string) => string,
    label: (text: string) => string,
  ) => {
    const codes = [
      ...a.map((f) => f.code),
      ...b.map((f) => f.code).filter((c) => !a.some((f) => f.code === c)),
    ];
    for (const code of codes) {
      const left = a.find((f) => f.code === code);
      const right = b.find((f) => f.code === code);
      push(
        prefix(code),
        label((right ?? left)?.label ?? code),
        left?.display ?? null,
        right?.display ?? null,
      );
    }
  };

  fieldRows(
    declared?.fields ?? [],
    measured.fields,
    (code) => answerKey(code),
    (text) => text,
  );
  const before = declared?.options ?? [];
  const optionCodes = [
    ...before.map((o) => o.optionCode),
    ...measured.options.map((o) => o.optionCode).filter((c) => !before.some((o) => o.optionCode === c)),
  ];
  for (const code of optionCodes) {
    const left = before.find((o) => o.optionCode === code);
    const right = measured.options.find((o) => o.optionCode === code);
    const label = (right ?? left)?.label ?? code;
    push(
      `options.${code}`,
      labels.option(label),
      left ? labels.chosen : labels.notChosen,
      right ? labels.chosen : labels.notChosen,
    );
    fieldRows(
      left?.fields ?? [],
      right?.fields ?? [],
      (field) => answerKey(field, code),
      (text) => `${label} — ${text}`,
    );
  }
  if (declared?.frequency || measured.frequency) {
    push(
      'frequency',
      labels.frequency,
      declared?.frequency?.label ?? null,
      measured.frequency?.label ?? null,
    );
  }
  return rows;
}
