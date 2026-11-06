import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { session } from '@/lib/api';
import { sessionBody } from '@/lib/api/session.test-utils';
import { calculation, errorBody, stubGateway, zone } from '@/features/cleaning/fake-gateway.test-utils';
import { CatalogScreen } from './catalog-screen';

const ADMIN = '/api/v1/admin/cleaning';
const WAIT = { timeout: 3000 };
const money = (amount: number) => ({ amount, currency: 'XOF' });

const service = (overrides: Record<string, unknown> = {}) => ({
  code: 'garden_maintenance',
  name: 'Entretien de jardin',
  description: 'Tonte.',
  unit: 'square_meter',
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
      pricePerUnit: null,
      choices: [],
      supplementIfYes: null,
      coefficientBpIfYes: null,
    },
  ],
  options: [],
  pricing: {
    version: 1,
    unitPrice: null,
    options: [],
    minimumPrice: null,
    frequencies: [{ code: 'once', label: 'Une fois', coefficientBp: 10000, active: true }],
    communeCoefficients: [],
    defaultCoefficientBp: 10000,
    teamSize: { fieldCode: 'surface', unitsPerAgent: 300, minAgents: 1, maxAgents: 6 },
    checklist: [],
    updatedBy: 'migration',
    updatedByName: null,
    updatedAt: '2026-11-04T08:00:00.000Z',
  },
  ...overrides,
});

const settings = {
  quoteValidityDays: 15,
  minimumLeadHours: 24,
  freeCancellationHours: 24,
  visitThresholdSquareMeters: 200,
  maxOpenRequests: 5,
  depositPercent: 30,
  businessWarningUnpaidInvoices: 1,
  businessSuspensionUnpaidInvoices: 2,
  individualSuspensionUnpaidInterventions: 1,
  individualPaymentGraceHours: 24,
  locationRetentionMonths: 12,
  updatedBy: null,
  updatedByName: null,
  updatedAt: null,
};

const place = (overrides: Record<string, unknown> = {}) => ({
  code: 'house',
  label: 'Maison',
  description: null,
  icon: 'house',
  displayOrder: 10,
  active: true,
  serviceCodes: ['garden_maintenance', 'old_service'],
  unknownServiceCodes: ['old_service'],
  inactiveServiceCodes: [],
  publiclyVisible: true,
  visibilityReason: null,
  updatedBy: null,
  updatedByName: null,
  updatedAt: null,
  ...overrides,
});

function routes(extra: Record<string, unknown> = {}) {
  return {
    [`GET ${ADMIN}/catalog`]: {
      status: 200,
      body: { services: [service()], settings, unplacedServiceCodes: [] },
    },
    [`GET ${ADMIN}/place-types`]: {
      status: 200,
      body: {
        data: [
          place(),
          place({
            code: 'office',
            label: 'Bureau',
            serviceCodes: [],
            unknownServiceCodes: [],
            publiclyVisible: false,
            visibilityReason: 'no_active_service',
          }),
        ],
      },
    },
    [`GET ${ADMIN}/zones`]: {
      status: 200,
      body: { data: [zone(), zone({ code: 'calavi', commune: 'Abomey-Calavi' })] },
    },
    ...extra,
  } as Parameters<typeof stubGateway>[0];
}

beforeEach(() => session.set(sessionBody(['cleaning_admin'])));
afterEach(() => vi.unstubAllGlobals());

describe('catalogue : types de lieu', () => {
  it('affiche les alertes de cohérence et enregistre un lieu sans la prestation supprimée', async () => {
    const { calls } = stubGateway(
      routes({
        [`PUT ${ADMIN}/place-types/house`]: { status: 200, body: place({ unknownServiceCodes: [] }) },
      }),
    );
    render(<CatalogScreen />);
    expect(await screen.findByText(/« old_service » n’existe plus/)).toBeInTheDocument();
    expect(screen.getByText('Masqué au public : aucune prestation active proposée')).toBeInTheDocument();
    fireEvent.click(
      within(screen.getByText('Maison').closest('li')!).getByRole('button', { name: 'Modifier' }),
    );
    const form = screen.getByRole('form', { name: 'Modifier « Maison »' });
    expect(
      within(form).getByText(/Prestations supprimées retirées de ce lieu : old_service/),
    ).toBeInTheDocument();
    fireEvent.click(within(form).getByRole('button', { name: 'Enregistrer le type de lieu' }));
    expect(await screen.findByText('Type de lieu « Maison » enregistré.')).toBeInTheDocument();
    expect(calls.find((call) => call.method === 'PUT')?.body).toEqual({
      label: 'Maison',
      icon: 'house',
      displayOrder: 10,
      active: true,
      serviceCodes: ['garden_maintenance'],
    });
  });
});

describe('catalogue : éditeur d’une prestation', () => {
  it('essai de prix en direct puis enregistrement d’une nouvelle version (FCFA, pourcentages → points)', async () => {
    const { calls } = stubGateway(
      routes({
        [`POST ${ADMIN}/catalog/services/garden_maintenance/preview`]: {
          status: 200,
          body: {
            serviceCode: 'garden_maintenance',
            covered: true,
            calculation: calculation({ computedPrice: money(60000) }),
          },
        },
        [`PUT ${ADMIN}/catalog/services/garden_maintenance`]: [
          {
            status: 400,
            body: errorBody('CLEANING_VALIDATION_FAILED', 'Maximum trop grand.', { field: 'fields[0].max' }),
          },
          { status: 200, body: service({ pricing: { ...service().pricing, version: 2 } }) },
        ],
      }),
    );
    render(<CatalogScreen />);
    expect(await screen.findByText('Entretien de jardin')).toBeInTheDocument();
    expect(screen.queryByText('garden_maintenance')).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Modifier' })[2]!);
    expect(await screen.findByText(/Enregistrer crée la version 2/)).toBeInTheDocument();

    fireEvent.change(screen.getAllByLabelText(/Prix par unité/)[0]!, { target: { value: '150' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter une fréquence' }));
    const frequencies = screen.getAllByLabelText('Fréquence', { selector: 'input' });
    fireEvent.change(frequencies[1]!, { target: { value: 'Chaque mois' } });
    fireEvent.change(screen.getAllByLabelText('Effet sur le prix (%)')[1]!, { target: { value: '-10' } });

    const sample = screen.getByLabelText(/Superficie/, { selector: '#essai-answers-surface' });
    fireEvent.change(sample, { target: { value: '400' } });
    fireEvent.change(screen.getByLabelText(/^Fréquence/, { selector: 'select' }), {
      target: { value: 'once' },
    });
    expect((await screen.findAllByText('60 000 F CFA', { exact: false }, WAIT)).length).toBeGreaterThan(0);
    const preview = calls.find((call) => call.path.endsWith('/preview'))?.body as Record<string, unknown>;
    expect(preview).toMatchObject({ commune: 'Cotonou', answers: { surface: 400 }, frequency: 'once' });

    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer (nouvelle version)' }));
    expect(await screen.findByText('Maximum trop grand.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer (nouvelle version)' }));
    expect(await screen.findByText('Version 2 enregistrée.')).toBeInTheDocument();
    const saved = calls.filter((call) => call.method === 'PUT').at(-1)?.body as {
      fields: Array<Record<string, unknown>>;
      pricing: { frequencies: unknown[] };
    };
    expect(saved.fields[0]).toMatchObject({ code: 'surface', pricePerUnit: 150 });
    expect(saved.pricing.frequencies).toEqual([
      { code: 'once', label: 'Une fois', coefficientBp: 10000, active: true },
      { code: 'chaque_mois', label: 'Chaque mois', coefficientBp: 9000, active: true },
    ]);
  });

  it('signale les champs à corriger avant tout envoi', async () => {
    const { calls } = stubGateway(routes());
    render(<CatalogScreen />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ajouter une prestation' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Enregistrer (nouvelle version)' }));
    expect(await screen.findByText('Corrigez les champs signalés en rouge.')).toBeInTheDocument();
    expect(screen.getByLabelText('Nom de la prestation')).toHaveAccessibleDescription(/Champ obligatoire/);
    await waitFor(() => expect(calls.some((call) => call.method === 'PUT')).toBe(false));
  });
});
