import { ApiError } from '@/lib/api';
import { calculation, quoteRequest, visit } from './fake-gateway.test-utils';
import {
  changedKeys,
  compareSummaries,
  errorKey,
  fieldError,
  type FormModel,
  initialValues,
  modelFromInput,
  modelFromPublicForm,
  readValues,
  summaryDisplays,
} from './form-model';
import { linesFromCalculation, prefillCalculation } from './components/quote-parts';
import { measuredSource } from './components/measurements-panel';
import { type AnswerSummary, quoteRequestSchema, serviceDefinitionSchema } from './schemas';
import {
  bpFromPercent,
  codeFromLabel,
  draftFromService,
  move,
  newField,
  newFrequency,
  percentFromBp,
  readServiceDraft,
} from './service-draft';
import { dossierStep, groupStep, measurementsOpen, stepState } from './workflow';

const messages = { required: 'obligatoire', integer: 'entier', range: () => 'bornes' };

const model: FormModel = modelFromPublicForm({
  fields: [
    {
      code: 'rooms',
      label: 'Nombre de pièces',
      type: 'number',
      required: true,
      helpText: null,
      unitLabel: 'pièces',
      min: 1,
      max: 20,
      choices: [],
    },
    {
      code: 'condition',
      label: 'État',
      type: 'choice',
      required: false,
      helpText: null,
      unitLabel: null,
      min: null,
      max: null,
      choices: [
        { code: 'normal', label: 'Normal' },
        { code: 'very_dirty', label: 'Très sale' },
      ],
    },
    { code: 'pets', label: 'Animaux', type: 'boolean', unitLabel: null, choices: [] },
  ],
  options: [
    {
      code: 'windows',
      label: 'Vitres',
      fields: [
        {
          code: 'window_count',
          label: 'Nombre de fenêtres',
          type: 'number',
          required: true,
          unitLabel: 'fenêtres',
          min: 1,
          max: 100,
          choices: [],
        },
      ],
    },
    { code: 'balcony', label: 'Balcon', fields: [] },
  ],
  frequencies: [
    { code: 'once', label: 'Une fois' },
    { code: 'weekly', label: 'Chaque semaine' },
  ],
});

const client = {
  answers: { rooms: 6, condition: 'normal', pets: false },
  options: [{ code: 'windows', answers: { window_count: 8 } }],
  frequency: 'once',
};

describe('formulaire construit depuis la définition', () => {
  it('lit les bornes, l’aide et l’obligation (absentes : valeurs neutres)', () => {
    expect(model.fields[0]).toMatchObject({ required: true, min: 1, max: 20, unitLabel: 'pièces' });
    expect(model.fields[2]).toMatchObject({ required: false, helpText: null, min: null });
    expect(model.options[1]).toMatchObject({ description: null, fields: [] });
  });

  it('préremplit avec une source, sinon vide ; « Non » par défaut ; fréquence unique choisie d’office', () => {
    const values = initialValues(model, client);
    expect(values.answers).toEqual({ rooms: '6', condition: 'normal', pets: false });
    expect(values.options).toEqual({
      windows: { checked: true, answers: { window_count: '8' } },
      balcony: { checked: false, answers: {} },
    });
    expect(values.frequency).toBe('once');
    expect(initialValues(model).answers).toEqual({ rooms: '', condition: '', pets: false });
    expect(initialValues({ ...model, frequencies: [{ code: 'once', label: 'Une fois' }] }).frequency).toBe(
      'once',
    );
  });

  it('les mesures déjà saisies passent avant les réponses du client', () => {
    const request = quoteRequestSchema.parse(
      quoteRequest({
        answers: client.answers,
        selectedOptions: client.options,
        frequency: 'once',
        measuredAnswers: { rooms: 8 },
        measuredOptions: [],
        measuredFrequency: 'weekly',
      }),
    );
    expect(measuredSource(request)).toEqual({ answers: { rooms: 8 }, options: [], frequency: 'weekly' });
    expect(measuredSource(quoteRequestSchema.parse(quoteRequest({ answers: client.answers })))).toMatchObject(
      { answers: client.answers },
    );
    expect(measuredSource(null)).toBeNull();
  });

  it('corps envoyé : facultatifs vides omis, options cochées, fréquence ; erreurs locales par champ', () => {
    const values = initialValues(model, client);
    expect(readValues(model, values, messages)).toEqual({
      body: {
        answers: { rooms: 6, condition: 'normal', pets: false },
        options: [{ code: 'windows', answers: { window_count: 8 } }],
        frequency: 'once',
      },
      errors: {},
    });
    const wrong = {
      ...values,
      answers: { rooms: '2,5', condition: '', pets: true },
      options: { windows: { checked: true, answers: { window_count: '500' } } },
      frequency: '',
    };
    const read = readValues(model, wrong, messages);
    expect(read.body.answers).toEqual({ pets: true });
    expect(read.errors).toEqual({
      'answers.rooms': 'entier',
      'options.windows.answers.window_count': 'bornes',
      frequency: 'obligatoire',
    });
  });

  it('place une erreur de la gateway sous le bon champ (mesures, options par position)', () => {
    const body = { answers: {}, options: [{ code: 'windows', answers: {} }] };
    expect(errorKey('measurements.answers.rooms', body)).toBe('answers.rooms');
    expect(errorKey('measurements[0].answers.surface', body)).toBe('answers.surface');
    expect(errorKey('options[0].answers.window_count', body)).toBe('options.windows.answers.window_count');
    expect(errorKey('options[3].code', body)).toBe('options');
    expect(errorKey('frequency', body)).toBe('frequency');
    expect(errorKey('report', body)).toBeNull();
    const error = new ApiError(400, 'CLEANING_VALIDATION_FAILED', 'Hors bornes.', {
      field: 'answers.rooms',
      reason: 'out_of_range',
    });
    expect(fieldError(error, body)).toEqual({ key: 'answers.rooms', message: 'Hors bornes.' });
    expect(fieldError(new ApiError(422, 'X', 'non'), body)).toBeNull();
  });

  it('signale les champs modifiés par rapport aux réponses du client', () => {
    const values = initialValues(model, client);
    expect(changedKeys(model, values, client).size).toBe(0);
    const edited = {
      ...values,
      answers: { ...values.answers, rooms: '8', pets: true },
      options: { ...values.options, balcony: { checked: true, answers: {} } },
      frequency: 'weekly',
    };
    expect([...changedKeys(model, edited, client)].sort()).toEqual([
      'answers.pets',
      'answers.rooms',
      'frequency',
      'options.balcony',
    ]);
  });

  it('met en évidence les écarts entre le déclaré et le constaté', () => {
    const field = (code: string, label: string, display: string) => ({
      code,
      label,
      type: 'number',
      value: 1,
      display,
      unitLabel: null,
    });
    const declared: AnswerSummary = {
      fields: [field('rooms', 'Pièces', '6 pièces'), field('baths', 'Salles de bain', '1')],
      options: [{ optionCode: 'windows', label: 'Vitres', fields: [field('count', 'Fenêtres', '8')] }],
      frequency: { code: 'once', label: 'Une fois' },
    };
    const measured: AnswerSummary = {
      fields: [field('rooms', 'Pièces', '8 pièces'), field('baths', 'Salles de bain', '1')],
      options: [],
      frequency: { code: 'once', label: 'Une fois' },
    };
    const rows = compareSummaries(declared, measured, {
      chosen: 'Choisie',
      notChosen: 'Non choisie',
      frequency: 'Fréquence',
      option: (label) => `Option ${label}`,
    });
    expect(rows.map((row) => [row.label, row.declared, row.measured, row.changed])).toEqual([
      ['Pièces', '6 pièces', '8 pièces', true],
      ['Salles de bain', '1', '1', false],
      ['Option Vitres', 'Choisie', 'Non choisie', true],
      ['Vitres — Fenêtres', '8', null, true],
      ['Fréquence', 'Une fois', 'Une fois', false],
    ]);
    expect(summaryDisplays(declared)).toEqual({
      'answers.rooms': '6 pièces',
      'answers.baths': '1',
      'options.windows': 'Vitres',
      'options.windows.answers.count': '8',
      frequency: 'Une fois',
    });
  });
});

describe('pourcentages et points de base', () => {
  it('convertit dans les deux sens', () => {
    expect(percentFromBp(13000)).toBe('+30');
    expect(percentFromBp(8500)).toBe('-15');
    expect(percentFromBp(10250)).toBe('+2,5');
    expect(percentFromBp(10000)).toBe('0');
    expect(percentFromBp(null)).toBe('');
    expect(bpFromPercent('30')).toBe(13000);
    expect(bpFromPercent('+30 %')).toBe(13000);
    expect(bpFromPercent('-15')).toBe(8500);
    expect(bpFromPercent('2,5')).toBe(10250);
    expect(bpFromPercent('')).toBeNull();
    expect(bpFromPercent('abc')).toBeNaN();
    expect(bpFromPercent('-100')).toBeNaN();
    expect(bpFromPercent('901')).toBeNaN();
  });

  it('tire un code lisible et unique d’un libellé', () => {
    expect(codeFromLabel('Très sale', new Set())).toBe('tres_sale');
    expect(codeFromLabel('Très sale', new Set(['tres_sale']))).toBe('tres_sale_2');
    expect(codeFromLabel('2 étages', new Set())).toBe('c_2_etages');
    expect(codeFromLabel('', new Set())).toMatch(/^[a-z][a-z0-9_]{1,49}$/);
    expect(move(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
    expect(move(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
  });
});

const editorMessages = {
  required: 'obligatoire',
  integer: 'entier',
  percent: 'pourcentage',
  minMax: 'min max',
  noActiveField: 'aucun champ',
  noChoice: 'aucune réponse',
  agents: 'agents',
};

const money = (amount: number) => ({ amount, currency: 'XOF' });
const definition = serviceDefinitionSchema.parse({
  code: 'garden_maintenance',
  name: 'Entretien de jardin',
  description: 'Tonte.',
  active: true,
  fields: [
    {
      code: 'surface',
      label: 'Superficie',
      type: 'number',
      required: true,
      helpText: null,
      active: true,
      unitLabel: 'm²',
      min: 1,
      max: 100000,
      pricePerUnit: money(150),
      choices: [],
      supplementIfYes: null,
      coefficientBpIfYes: null,
    },
    {
      code: 'condition',
      label: 'État',
      type: 'choice',
      required: true,
      helpText: null,
      active: true,
      unitLabel: null,
      min: null,
      max: null,
      pricePerUnit: null,
      choices: [
        { code: 'maintained', label: 'Entretenu', supplement: money(0), coefficientBp: null, active: true },
        { code: 'overgrown', label: 'Envahi', supplement: null, coefficientBp: 13000, active: true },
      ],
      supplementIfYes: null,
      coefficientBpIfYes: null,
    },
  ],
  options: [
    {
      code: 'waste',
      label: 'Déchets verts',
      description: null,
      active: true,
      flatPrice: money(10000),
      fields: [],
    },
  ],
  pricing: {
    version: 4,
    minimumPrice: money(15000),
    frequencies: [{ code: 'once', label: 'Une fois', coefficientBp: 10000, active: true }],
    communeCoefficients: [{ commune: 'Abomey-Calavi', coefficientBp: 10500 }],
    defaultCoefficientBp: 10000,
    teamSize: { fieldCode: 'surface', unitsPerAgent: 300, minAgents: 1, maxAgents: 6 },
    checklist: [{ code: 'arrival', label: 'Arrivée' }],
    updatedBy: null,
    updatedAt: null,
  },
});

describe('brouillon d’une prestation', () => {
  it('relit une prestation existante à l’identique (montants en FCFA, effets en points de base)', () => {
    const { code, input, errors } = readServiceDraft(draftFromService(definition), editorMessages);
    expect(errors).toEqual({});
    expect(code).toBe('garden_maintenance');
    expect(input).toEqual({
      name: 'Entretien de jardin',
      description: 'Tonte.',
      active: true,
      fields: [
        {
          code: 'surface',
          label: 'Superficie',
          required: true,
          active: true,
          helpText: null,
          type: 'number',
          unitLabel: 'm²',
          min: 1,
          max: 100000,
          pricePerUnit: 150,
        },
        {
          code: 'condition',
          label: 'État',
          required: true,
          active: true,
          helpText: null,
          type: 'choice',
          choices: [
            { code: 'maintained', label: 'Entretenu', supplement: 0, coefficientBp: null, active: true },
            { code: 'overgrown', label: 'Envahi', supplement: null, coefficientBp: 13000, active: true },
          ],
        },
      ],
      options: [
        {
          code: 'waste',
          label: 'Déchets verts',
          description: null,
          active: true,
          flatPrice: 10000,
          fields: [],
        },
      ],
      pricing: {
        minimumPrice: 15000,
        communeCoefficients: [{ commune: 'Abomey-Calavi', coefficientBp: 10500 }],
        defaultCoefficientBp: 10000,
        frequencies: [{ code: 'once', label: 'Une fois', coefficientBp: 10000, active: true }],
        teamSize: { fieldCode: 'surface', unitsPerAgent: 300, minAgents: 1, maxAgents: 6 },
        checklist: [{ code: 'arrival', label: 'Arrivée' }],
      },
    });
  });

  it('donne un code aux nouveaux éléments et signale les erreurs au chemin du contrat', () => {
    const draft = draftFromService(definition);
    draft.fields.push({ ...newField('boolean'), label: 'Accès difficile', coefficientIfYes: '+20' });
    draft.fields[0] = { ...draft.fields[0]!, min: '50', max: '10' };
    draft.frequencies.push({ ...newFrequency(), label: 'Chaque mois', coefficient: 'x' });
    const { input, errors } = readServiceDraft(draft, editorMessages);
    expect(input.fields[2]).toMatchObject({
      code: 'acces_difficile',
      type: 'boolean',
      coefficientBpIfYes: 12000,
    });
    expect(errors).toEqual({
      'fields[0].max': 'min max',
      'pricing.frequencies[1].coefficientBp': 'pourcentage',
    });
  });

  it('nouvelle prestation : code tiré du nom, une question et « Une fois » par défaut', () => {
    const draft = { ...draftFromService(null), name: 'Nettoyage de vitres' };
    const { code, input, errors } = readServiceDraft(draft, editorMessages, new Set(['nettoyage_de_vitres']));
    expect(code).toBe('nettoyage_de_vitres_2');
    expect(errors).toEqual({});
    expect(input.fields[0]).toMatchObject({
      type: 'number',
      label: 'Superficie',
      unitLabel: 'm²',
      pricePerUnit: null,
    });
    expect(input.pricing.frequencies).toEqual([
      { code: 'une_fois', label: 'Une fois', coefficientBp: 10000, active: true },
    ]);
    expect(input.pricing.teamSize?.fieldCode).toBe(input.fields[0]?.code);
    expect(modelFromInput(input).frequencies).toEqual([{ code: 'une_fois', label: 'Une fois' }]);
  });
});

describe('étape du dossier', () => {
  const parse = (overrides: Record<string, unknown> = {}) =>
    quoteRequestSchema.parse(quoteRequest(overrides));

  it('suit la demande, la visite, le devis, la mission et le paiement', () => {
    expect(dossierStep(parse())).toBe('visit');
    expect(dossierStep(parse({ status: 'visit_scheduled', visit: visit() }))).toBe('visit');
    expect(dossierStep(parse({ status: 'visit_scheduled', visit: visit({ status: 'completed' }) }))).toBe(
      'quote',
    );
    expect(dossierStep(parse({ status: 'quote_sent' }))).toBe('quote');
    const accepted = parse({ status: 'accepted' });
    expect(dossierStep(accepted)).toBe('mission');
    expect(dossierStep(accepted, { status: 'scheduled', payment: { status: 'due' } })).toBe('mission');
    expect(dossierStep(accepted, { status: 'completed', payment: { status: 'due' } })).toBe('payment');
    expect(dossierStep(accepted, { status: 'completed', payment: { status: 'paid' } })).toBe('done');
    expect(dossierStep(accepted, { status: 'cancelled', payment: { status: 'due' } })).toBe('closed');
    expect(dossierStep(parse({ status: 'rejected' }))).toBe('closed');
  });

  it('état de chaque étape, y compris pour un dossier clos', () => {
    const request = parse({ status: 'visit_scheduled', visit: visit({ status: 'completed' }) });
    expect(
      ['request', 'visit', 'quote', 'mission'].map((s) => stepState(s as 'visit', 'quote', request)),
    ).toEqual(['done', 'done', 'current', 'upcoming']);
    const closed = parse({ status: 'rejected', visit: visit({ status: 'completed' }) });
    expect(stepState('visit', 'closed', closed)).toBe('done');
    expect(stepState('quote', 'closed', closed)).toBe('upcoming');
    expect(stepState('payment', 'done', closed)).toBe('done');
  });

  it('groupe : étape de la demande la moins avancée ; mesures ouvertes avant le devis', () => {
    expect(
      groupStep([parse({ status: 'quote_sent' }), parse({ status: 'visit_scheduled', visit: visit() })]),
    ).toBe('visit');
    expect(groupStep([parse({ status: 'rejected' })])).toBe('closed');
    expect(measurementsOpen({ status: 'visit_scheduled' })).toBe(true);
    expect(measurementsOpen({ status: 'quote_sent' })).toBe(false);
  });
});

describe('devis prérempli depuis les mesures', () => {
  it('préfère le calcul des mesures et reprend ses lignes avec l’ajustement', () => {
    const request = quoteRequestSchema.parse(quoteRequest({ calculation: calculation() }));
    expect(prefillCalculation(request)?.measured).toBe(false);
    const measured = quoteRequestSchema.parse(
      quoteRequest({
        calculation: calculation(),
        measuredCalculation: calculation({ recommendedTeamSize: 3 }),
      }),
    );
    expect(prefillCalculation(measured)?.measured).toBe(true);
    expect(linesFromCalculation(measured.measuredCalculation!)).toEqual([
      { label: 'Superficie', quantity: '120', unitPrice: '100' },
      { label: 'Ajustement (coefficients)', quantity: '1', unitPrice: '1800' },
    ]);
    const unpriced = quoteRequestSchema.parse(
      quoteRequest({ calculation: calculation({ priced: false, computedPrice: null }) }),
    );
    expect(linesFromCalculation(unpriced.calculation!)).toEqual([]);
  });
});
