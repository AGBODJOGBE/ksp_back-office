import type { FieldInput, ServiceInput } from './api';
import type { FieldDefinition, ServiceDefinition } from './schemas';

/*
 * Brouillon de l'éditeur d'une prestation (catalogue, ADR-033) : tout est saisi en texte, les montants en
 * FCFA entiers et les coefficients en pourcentage lisible (« +30 », « -15 »), puis lu selon le contrat
 * (`SaveCleaningServiceRequest`, coefficients en points de base). Les codes des nouveaux éléments sont tirés
 * de leur libellé : l'admin n'écrit aucun code. Aucune règle de prix ici : la gateway calcule et valide.
 */

/** Points de base : 10 000 = ×1 (sans effet). */
const NEUTRAL_BP = 10_000;

const percentFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2, signDisplay: 'exceptZero' });

/** Coefficient en points de base → variation en pourcentage lisible : 13 000 → « +30 », 8 500 → « -15 », null → « ». */
export function percentFromBp(bp: number | null | undefined): string {
  if (bp === null || bp === undefined) return '';
  return percentFormat.format((bp - NEUTRAL_BP) / 100).replace('−', '-');
}

/**
 * Variation en pourcentage → points de base : « 30 » ou « +30 % » → 13 000, « -15 » → 8 500, « 2,5 » → 10 250 ;
 * vide → `null` ; `NaN` si la saisie est invalide ou hors des bornes du contrat (1 à 100 000 points).
 */
export function bpFromPercent(text: string): number | null {
  const cleaned = text.replace(/\s|%/g, '').replace(',', '.').replace('−', '-');
  if (!cleaned) return null;
  if (!/^[+-]?\d+(\.\d{1,2})?$/.test(cleaned)) return Number.NaN;
  const bp = Math.round(NEUTRAL_BP + Number(cleaned) * 100);
  return bp >= 1 && bp <= 100_000 ? bp : Number.NaN;
}

/** Code tiré d'un libellé (`^[a-z][a-z0-9_]{1,49}$`), distinct de ceux déjà pris : « Très sale » → `tres_sale`. */
export function codeFromLabel(label: string, taken: ReadonlySet<string>): string {
  let base = label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!/^[a-z]/.test(base)) base = `c_${base}`.replace(/_+$/, '');
  if (base.length < 2) base = `${base}_1`;
  base = base.slice(0, 44).replace(/_+$/, '');
  let code = base;
  for (let index = 2; taken.has(code); index += 1) code = `${base}_${index}`;
  return code;
}

let counter = 0;
/** Clé React stable d'un élément du brouillon. */
const nextKey = () => `k${++counter}`;

export type FieldType = 'number' | 'choice' | 'boolean';

export interface ChoiceDraft {
  key: string;
  code: string;
  label: string;
  supplement: string;
  coefficient: string;
  active: boolean;
}

export interface FieldDraft {
  key: string;
  code: string;
  label: string;
  type: FieldType;
  required: boolean;
  helpText: string;
  active: boolean;
  unitLabel: string;
  min: string;
  max: string;
  pricePerUnit: string;
  choices: ChoiceDraft[];
  supplementIfYes: string;
  coefficientIfYes: string;
}

export interface OptionDraft {
  key: string;
  code: string;
  label: string;
  description: string;
  active: boolean;
  flatPrice: string;
  fields: FieldDraft[];
}

export interface FrequencyDraft {
  key: string;
  code: string;
  label: string;
  coefficient: string;
  active: boolean;
}

export interface CommuneDraft {
  key: string;
  commune: string;
  coefficient: string;
}

export interface ChecklistDraft {
  key: string;
  code: string;
  label: string;
}

export interface ServiceDraft {
  /** Code de la prestation : vide pour une nouvelle (tiré du nom à l'enregistrement). */
  code: string;
  name: string;
  description: string;
  active: boolean;
  fields: FieldDraft[];
  options: OptionDraft[];
  frequencies: FrequencyDraft[];
  minimumPrice: string;
  communes: CommuneDraft[];
  defaultCoefficient: string;
  /** Clé (`key`) du champ nombre qui porte la quantité de la taille d'équipe ; vide : aucun. */
  teamFieldKey: string;
  unitsPerAgent: string;
  minAgents: string;
  maxAgents: string;
  checklist: ChecklistDraft[];
}

const amount = (money: { amount: number } | null | undefined) => (money ? String(money.amount) : '');
const integerText = (value: number | null | undefined) =>
  value === null || value === undefined ? '' : String(value);

export function newChoice(): ChoiceDraft {
  return { key: nextKey(), code: '', label: '', supplement: '0', coefficient: '', active: true };
}

export function newField(type: FieldType): FieldDraft {
  return {
    key: nextKey(),
    code: '',
    label: '',
    type,
    required: type !== 'boolean',
    helpText: '',
    active: true,
    unitLabel: '',
    min: type === 'number' ? '1' : '',
    max: type === 'number' ? '1000' : '',
    pricePerUnit: '',
    choices: type === 'choice' ? [newChoice(), newChoice()] : [],
    supplementIfYes: '',
    coefficientIfYes: '',
  };
}

export function newOption(): OptionDraft {
  return { key: nextKey(), code: '', label: '', description: '', active: true, flatPrice: '', fields: [] };
}

export function newFrequency(): FrequencyDraft {
  return { key: nextKey(), code: '', label: '', coefficient: '0', active: true };
}

export function newCommune(): CommuneDraft {
  return { key: nextKey(), commune: '', coefficient: '0' };
}

export function newChecklistItem(): ChecklistDraft {
  return { key: nextKey(), code: '', label: '' };
}

const asType = (type: string): FieldType => (type === 'choice' || type === 'boolean' ? type : 'number');

function fieldDraft(field: FieldDefinition): FieldDraft {
  return {
    key: nextKey(),
    code: field.code,
    label: field.label,
    type: asType(field.type),
    required: field.required,
    helpText: field.helpText ?? '',
    active: field.active,
    unitLabel: field.unitLabel ?? '',
    min: integerText(field.min),
    max: integerText(field.max),
    pricePerUnit: amount(field.pricePerUnit),
    choices: field.choices.map((choice) => ({
      key: nextKey(),
      code: choice.code,
      label: choice.label,
      supplement: amount(choice.supplement),
      coefficient: percentFromBp(choice.coefficientBp),
      active: choice.active,
    })),
    supplementIfYes: amount(field.supplementIfYes),
    coefficientIfYes: percentFromBp(field.coefficientBpIfYes),
  };
}

/** Brouillon d'une prestation existante, ou d'une nouvelle (un champ nombre, une fréquence « Une fois »). */
export function draftFromService(service: ServiceDefinition | null): ServiceDraft {
  if (!service) {
    const surface = { ...newField('number'), label: 'Superficie', unitLabel: 'm²', max: '100000' };
    return {
      code: '',
      name: '',
      description: '',
      active: false,
      fields: [surface],
      options: [],
      frequencies: [{ ...newFrequency(), label: 'Une fois' }],
      minimumPrice: '',
      communes: [],
      defaultCoefficient: '0',
      teamFieldKey: surface.key,
      unitsPerAgent: '100',
      minAgents: '1',
      maxAgents: '4',
      checklist: [],
    };
  }
  const { pricing } = service;
  const fields = service.fields.map(fieldDraft);
  return {
    code: service.code,
    name: service.name,
    description: service.description,
    active: service.active,
    fields,
    options: service.options.map((option) => ({
      key: nextKey(),
      code: option.code,
      label: option.label,
      description: option.description ?? '',
      active: option.active,
      flatPrice: amount(option.flatPrice),
      fields: option.fields.map(fieldDraft),
    })),
    frequencies: pricing.frequencies.map((frequency) => ({
      key: nextKey(),
      code: frequency.code,
      label: frequency.label,
      coefficient: percentFromBp(frequency.coefficientBp) || '0',
      active: frequency.active,
    })),
    minimumPrice: amount(pricing.minimumPrice),
    communes: pricing.communeCoefficients.map((item) => ({
      key: nextKey(),
      commune: item.commune,
      coefficient: percentFromBp(item.coefficientBp) || '0',
    })),
    defaultCoefficient: percentFromBp(pricing.defaultCoefficientBp) || '0',
    teamFieldKey: fields.find((field) => field.code === pricing.teamSize.fieldCode)?.key ?? '',
    unitsPerAgent: String(pricing.teamSize.unitsPerAgent),
    minAgents: String(pricing.teamSize.minAgents),
    maxAgents: String(pricing.teamSize.maxAgents),
    checklist: pricing.checklist.map((item) => ({ key: nextKey(), code: item.code, label: item.label })),
  };
}

/** Messages des contrôles de l'éditeur. */
export interface DraftMessages {
  required: string;
  integer: string;
  percent: string;
  minMax: string;
  noActiveField: string;
  noChoice: string;
  agents: string;
}

export type DraftErrors = Record<string, string>;

/** Entier ≥ 0 saisi ; vide → `null` ; `NaN` s'il est invalide. */
function wholeNumber(text: string): number | null {
  const trimmed = text.replace(/\s/g, '');
  if (!trimmed) return null;
  return /^\d+$/.test(trimmed) ? Number(trimmed) : Number.NaN;
}

/** Codes : ceux des éléments existants sont gardés, ceux des nouveaux tirés du libellé, sans doublon. */
function assignCodes<T extends { code: string; label: string }>(items: readonly T[]): string[] {
  const taken = new Set(items.map((item) => item.code).filter(Boolean));
  return items.map((item) => {
    if (item.code) return item.code;
    const code = codeFromLabel(item.label || 'element', taken);
    taken.add(code);
    return code;
  });
}

function readField(
  field: FieldDraft,
  code: string,
  path: string,
  m: DraftMessages,
  errors: DraftErrors,
): FieldInput {
  const label = field.label.trim();
  if (!label) errors[`${path}.label`] = m.required;
  const common = {
    code,
    label,
    required: field.required,
    active: field.active,
    helpText: field.helpText.trim() || null,
  };
  if (field.type === 'number') {
    const unitLabel = field.unitLabel.trim();
    if (!unitLabel) errors[`${path}.unitLabel`] = m.required;
    const min = wholeNumber(field.min);
    const max = wholeNumber(field.max);
    const price = wholeNumber(field.pricePerUnit);
    if (min === null || Number.isNaN(min) || min > 1_000_000) errors[`${path}.min`] = m.integer;
    if (max === null || Number.isNaN(max) || max > 1_000_000) errors[`${path}.max`] = m.integer;
    else if (min !== null && !Number.isNaN(min) && min > max) errors[`${path}.max`] = m.minMax;
    if (Number.isNaN(price)) errors[`${path}.pricePerUnit`] = m.integer;
    return { ...common, type: 'number', unitLabel, min: min ?? 0, max: max ?? 0, pricePerUnit: price };
  }
  if (field.type === 'choice') {
    if (!field.choices.length) errors[`${path}.choices`] = m.noChoice;
    const codes = assignCodes(field.choices);
    return {
      ...common,
      type: 'choice',
      choices: field.choices.map((choice, index) => {
        const at = `${path}.choices[${index}]`;
        const choiceLabel = choice.label.trim();
        if (!choiceLabel) errors[`${at}.label`] = m.required;
        const supplement = wholeNumber(choice.supplement);
        if (Number.isNaN(supplement)) errors[`${at}.supplement`] = m.integer;
        const coefficientBp = bpFromPercent(choice.coefficient);
        if (Number.isNaN(coefficientBp)) errors[`${at}.coefficientBp`] = m.percent;
        return {
          code: codes[index] ?? '',
          label: choiceLabel,
          supplement,
          coefficientBp,
          active: choice.active,
        };
      }),
    };
  }
  const supplementIfYes = wholeNumber(field.supplementIfYes);
  if (Number.isNaN(supplementIfYes)) errors[`${path}.supplementIfYes`] = m.integer;
  const coefficientBpIfYes = bpFromPercent(field.coefficientIfYes);
  if (Number.isNaN(coefficientBpIfYes)) errors[`${path}.coefficientBpIfYes`] = m.percent;
  return { ...common, type: 'boolean', supplementIfYes, coefficientBpIfYes };
}

function readFields(fields: readonly FieldDraft[], prefix: string, m: DraftMessages, errors: DraftErrors) {
  const codes = assignCodes(fields);
  return fields.map((field, index) => readField(field, codes[index] ?? '', `${prefix}[${index}]`, m, errors));
}

/** Coefficient obligatoire : vide = sans effet (10 000 points). */
function requiredBp(text: string, path: string, m: DraftMessages, errors: DraftErrors): number {
  const bp = bpFromPercent(text);
  if (Number.isNaN(bp)) {
    errors[path] = m.percent;
    return NEUTRAL_BP;
  }
  return bp ?? NEUTRAL_BP;
}

/**
 * Lit le brouillon selon le contrat (`SaveCleaningServiceRequest`). Les erreurs portent le chemin de la
 * propriété, comme celles de la gateway (`fields[0].max`, `pricing.frequencies[1].coefficientBp`) : un même
 * affichage sert aux deux. `code` : code de la prestation (tiré du nom pour une nouvelle).
 */
export function readServiceDraft(
  draft: ServiceDraft,
  m: DraftMessages,
  takenServiceCodes: ReadonlySet<string> = new Set(),
): { code: string; input: ServiceInput; errors: DraftErrors } {
  const errors: DraftErrors = {};
  const name = draft.name.trim();
  if (!name) errors.name = m.required;
  const code = draft.code || codeFromLabel(name || 'prestation', takenServiceCodes);

  const fields = readFields(draft.fields, 'fields', m, errors);
  if (!draft.fields.some((field) => field.active)) errors.fields = m.noActiveField;

  const optionCodes = assignCodes(draft.options);
  const options = draft.options.map((option, index) => {
    const path = `options[${index}]`;
    const label = option.label.trim();
    if (!label) errors[`${path}.label`] = m.required;
    const flatPrice = wholeNumber(option.flatPrice);
    if (Number.isNaN(flatPrice)) errors[`${path}.flatPrice`] = m.integer;
    return {
      code: optionCodes[index] ?? '',
      label,
      description: option.description.trim() || null,
      active: option.active,
      flatPrice,
      fields: readFields(option.fields, `${path}.fields`, m, errors),
    };
  });

  const frequencyCodes = assignCodes(draft.frequencies);
  const frequencies = draft.frequencies.map((frequency, index) => {
    const path = `pricing.frequencies[${index}]`;
    const label = frequency.label.trim();
    if (!label) errors[`${path}.label`] = m.required;
    return {
      code: frequencyCodes[index] ?? '',
      label,
      coefficientBp: requiredBp(frequency.coefficient, `${path}.coefficientBp`, m, errors),
      active: frequency.active,
    };
  });

  const communeCoefficients = draft.communes.map((item, index) => {
    const path = `pricing.communeCoefficients[${index}]`;
    const commune = item.commune.trim();
    if (!commune) errors[`${path}.commune`] = m.required;
    return { commune, coefficientBp: requiredBp(item.coefficient, `${path}.coefficientBp`, m, errors) };
  });

  const minimumPrice = wholeNumber(draft.minimumPrice);
  if (Number.isNaN(minimumPrice)) errors['pricing.minimumPrice'] = m.integer;

  const unitsPerAgent = wholeNumber(draft.unitsPerAgent);
  const minAgents = wholeNumber(draft.minAgents);
  const maxAgents = wholeNumber(draft.maxAgents);
  const positive = (value: number | null) => value !== null && !Number.isNaN(value) && value >= 1;
  if (!positive(unitsPerAgent)) errors['pricing.teamSize.unitsPerAgent'] = m.integer;
  if (!positive(minAgents)) errors['pricing.teamSize.minAgents'] = m.integer;
  if (!positive(maxAgents)) errors['pricing.teamSize.maxAgents'] = m.integer;
  else if (positive(minAgents) && (minAgents ?? 0) > (maxAgents ?? 0))
    errors['pricing.teamSize.maxAgents'] = m.agents;
  const teamIndex = draft.fields.findIndex(
    (field) => field.key === draft.teamFieldKey && field.type === 'number',
  );

  const checklistCodes = assignCodes(draft.checklist);
  const checklist = draft.checklist.map((item, index) => {
    const label = item.label.trim();
    if (!label) errors[`pricing.checklist[${index}].label`] = m.required;
    return { code: checklistCodes[index] ?? '', label };
  });

  const input: ServiceInput = {
    name,
    description: draft.description.trim(),
    active: draft.active,
    fields,
    options,
    pricing: {
      minimumPrice,
      communeCoefficients,
      defaultCoefficientBp: requiredBp(draft.defaultCoefficient, 'pricing.defaultCoefficientBp', m, errors),
      frequencies,
      teamSize: {
        fieldCode: teamIndex >= 0 ? (fields[teamIndex]?.code ?? null) : null,
        unitsPerAgent: unitsPerAgent ?? 1,
        minAgents: minAgents ?? 1,
        maxAgents: maxAgents ?? 1,
      },
      checklist,
    },
  };
  return { code, input, errors };
}

/** Déplace un élément d'une liste d'un cran (−1 : vers le haut, +1 : vers le bas). */
export function move<T>(items: readonly T[], index: number, step: -1 | 1): T[] {
  const target = index + step;
  if (target < 0 || target >= items.length) return [...items];
  const next = [...items];
  [next[index], next[target]] = [next[target] as T, next[index] as T];
  return next;
}
