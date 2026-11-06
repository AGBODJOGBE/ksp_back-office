import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { session } from '@/lib/api';
import { sessionBody } from '@/lib/api/session.test-utils';
import { forgetServiceNames } from '@/features/cleaning/api';
import {
  agent,
  calculation,
  errorBody,
  groupedRequest,
  ids,
  stubGateway,
  visit,
} from '@/features/cleaning/fake-gateway.test-utils';
import { RequestDetail } from './request-detail';
import { VisitsList } from './visits-list';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => '/nettoyage/visites',
  useSearchParams: () => new URLSearchParams(''),
}));

const ADMIN = '/api/v1/admin/cleaning';
const REQUEST = `${ADMIN}/quote-requests/${ids.request}`;
const AGENTS = { [`GET ${ADMIN}/agents`]: { status: 200, body: { data: [agent()] } } };
const WAIT = { timeout: 3000 };

const field = (overrides: Record<string, unknown>) => ({
  helpText: null,
  unitLabel: null,
  min: null,
  max: null,
  choices: [],
  required: true,
  ...overrides,
});

/** Formulaire public de la prestation TEST (`CleaningServiceForm`). */
const SERVICES = {
  status: 200,
  body: {
    data: [
      {
        code: 'house_cleaning',
        name: 'Nettoyage de maison TEST',
        form: {
          fields: [
            field({
              code: 'surface',
              label: 'Superficie',
              type: 'number',
              unitLabel: 'm²',
              min: 1,
              max: 5000,
            }),
            field({
              code: 'condition',
              label: 'État du logement',
              type: 'choice',
              choices: [
                { code: 'normal', label: 'Normal' },
                { code: 'dirty', label: 'Très sale' },
              ],
            }),
          ],
          options: [],
          frequencies: [{ code: 'once', label: 'Une fois' }],
        },
      },
    ],
  },
};

const summary = (surface: string, condition: string) => ({
  fields: [
    { code: 'surface', label: 'Superficie', type: 'number', value: 1, display: surface, unitLabel: 'm²' },
    {
      code: 'condition',
      label: 'État du logement',
      type: 'choice',
      value: 'dirty',
      display: condition,
      unitLabel: null,
    },
  ],
  options: [],
  frequency: { code: 'once', label: 'Une fois' },
});

const request = (overrides: Record<string, unknown> = {}) =>
  groupedRequest({
    groupId: null,
    groupSize: 1,
    status: 'visit_scheduled',
    visit: visit(),
    answers: { surface: 120, condition: 'dirty' },
    selectedOptions: [],
    options: [],
    answerSummary: summary('120 m²', 'Très sale'),
    ...overrides,
  });

const estimate = (amount: number) => ({
  status: 200,
  body: {
    requestId: ids.request,
    serviceCode: 'house_cleaning',
    commune: 'Cotonou',
    calculation: calculation({ computedPrice: { amount, currency: 'XOF' } }),
  },
});

beforeEach(() => {
  forgetServiceNames();
  session.set(sessionBody(['cleaning_supervisor']));
});

afterEach(() => vi.unstubAllGlobals());

describe('mesures constatées sur la fiche', () => {
  it('préremplit avec le client, recalcule à chaque modification et enregistre avec les écarts', async () => {
    const { calls } = stubGateway({
      'GET /api/v1/cleaning/services': SERVICES,
      [`GET ${REQUEST}`]: { status: 200, body: request() },
      [`POST ${REQUEST}/estimate`]: (body) =>
        estimate((body as { answers: { surface: number } }).answers.surface * 100),
      [`PUT ${REQUEST}/measurements`]: {
        status: 200,
        body: request({
          measuredAnswers: { surface: 200, condition: 'dirty' },
          measuredOptions: [],
          measuredFrequency: 'once',
          measuredAt: '2026-11-04T10:00:00Z',
          measuredByName: 'Afi',
          measuredSummary: summary('200 m²', 'Très sale'),
        }),
      },
      ...AGENTS,
    });
    render(<RequestDetail id={ids.request} />);
    const surface = await screen.findByLabelText(/Superficie/, { selector: 'input' }, WAIT);
    expect(surface).toHaveValue('120');
    expect(screen.getByText('Déclaré par le client : 120 m²')).toBeInTheDocument();
    await waitFor(() => expect(calls.some((call) => call.path.endsWith('/estimate'))).toBe(true), WAIT);
    expect(calls.find((call) => call.path.endsWith('/estimate'))?.body).toEqual({
      answers: { surface: 120, condition: 'dirty' },
      frequency: 'once',
    });

    fireEvent.change(surface, { target: { value: '200' } });
    expect(screen.getByText('Modifié')).toBeInTheDocument();
    expect((await screen.findAllByText('20 000 F CFA', { exact: false }, WAIT)).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer les mesures seulement' }));
    expect(await screen.findByText(/Mesures enregistrées/)).toBeInTheDocument();
    expect(calls.find((call) => call.method === 'PUT')?.body).toEqual({
      answers: { surface: 200, condition: 'dirty' },
      frequency: 'once',
    });
    const table = screen.getByRole('table', { name: 'Réponses du client et mesures constatées' });
    expect(within(table).getByText('200 m²')).toBeInTheDocument();
    expect(within(table).getByText('Écart')).toBeInTheDocument();
    expect(screen.getByText('1 écart avec la demande du client.')).toBeInTheDocument();
  });

  it('erreur de la gateway sous le bon champ, puis lecture seule si un devis est déjà envoyé', async () => {
    stubGateway({
      'GET /api/v1/cleaning/services': SERVICES,
      [`GET ${REQUEST}`]: { status: 200, body: request() },
      [`POST ${REQUEST}/estimate`]: {
        status: 400,
        body: errorBody('CLEANING_VALIDATION_FAILED', 'Superficie hors des bornes.', {
          field: 'answers.surface',
          reason: 'out_of_range',
        }),
      },
      [`PUT ${REQUEST}/measurements`]: {
        status: 422,
        body: errorBody('CLEANING_MEASUREMENTS_LOCKED', 'Devis déjà envoyé.', { status: 'quote_sent' }),
      },
      ...AGENTS,
    });
    render(<RequestDetail id={ids.request} />);
    const surface = await screen.findByLabelText(/Superficie/, { selector: 'input' }, WAIT);
    await waitFor(() => expect(surface).toHaveAccessibleDescription(/Superficie hors des bornes/), WAIT);

    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer les mesures seulement' }));
    expect((await screen.findAllByText(/les mesures ne peuvent plus être modifiées/)).length).toBeGreaterThan(
      0,
    );
    expect(surface).toBeDisabled();
  });

  it('clôt la visite avec le compte rendu et les mesures, après confirmation', async () => {
    const { calls } = stubGateway({
      'GET /api/v1/cleaning/services': SERVICES,
      [`GET ${REQUEST}`]: { status: 200, body: request() },
      [`POST ${REQUEST}/estimate`]: estimate(12000),
      [`POST ${ADMIN}/visits/${ids.visit}/complete`]: {
        status: 200,
        body: request({ visit: visit({ status: 'completed', report: 'RAS' }) }),
      },
      ...AGENTS,
    });
    render(<RequestDetail id={ids.request} />);
    await screen.findByLabelText(/Superficie/, { selector: 'input' }, WAIT);
    fireEvent.click(screen.getByRole('button', { name: 'Clore la visite avec ces mesures' }));
    const dialog = screen.getByRole('dialog', { name: 'Clore la visite ?' });
    fireEvent.change(within(dialog).getByLabelText(/Compte rendu de la visite/), {
      target: { value: 'RAS' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Clore la visite' }));
    expect(await screen.findByRole('button', { name: 'Établir le devis' })).toBeInTheDocument();
    expect(calls.find((call) => call.path.endsWith('/complete'))?.body).toEqual({
      report: 'RAS',
      measurements: { answers: { surface: 120, condition: 'dirty' }, frequency: 'once' },
    });
  });
});

describe('mesures saisies par l’agent depuis ses visites', () => {
  it('ouvre le formulaire vide de sa visite et enregistre ses mesures', async () => {
    session.set(sessionBody(['cleaning_agent']));
    const { calls } = stubGateway({
      'GET /api/v1/cleaning/services': SERVICES,
      [`GET ${ADMIN}/visits`]: {
        status: 200,
        body: {
          data: [
            {
              id: ids.visit,
              groupVisitId: null,
              groupId: null,
              status: 'scheduled',
              scheduledAt: '2026-11-04T09:00:00Z',
              completedAt: null,
              report: null,
              agentId: ids.agent,
              agentName: 'Awa B.',
              customerId: ids.customer,
              customerName: 'Koffi Adjovi',
              organizationName: null,
              commune: 'Cotonou',
              address: 'Rue 12',
              location: null,
              landmark: null,
              geocodedAddress: null,
              placeType: 'house',
              placeTypeLabel: 'Maison',
              requests: [
                {
                  requestId: ids.request,
                  visitId: ids.visit,
                  serviceCode: 'house_cleaning',
                  serviceName: 'Nettoyage de maison TEST',
                  status: 'visit_scheduled',
                },
              ],
            },
          ],
          nextCursor: null,
        },
      },
      [`POST ${REQUEST}/estimate`]: estimate(15000),
      [`PUT ${REQUEST}/measurements`]: {
        status: 200,
        body: request({
          measuredAnswers: { surface: 150, condition: 'normal' },
          measuredSummary: summary('150 m²', 'Normal'),
          measuredAt: '2026-11-04T10:00:00Z',
          measuredByName: 'Awa B.',
        }),
      },
    });
    render(<VisitsList />);
    fireEvent.click(await screen.findByRole('button', { name: /^Saisir les mesures/ }));
    const surface = await screen.findByLabelText(/Superficie/, { selector: 'input' }, WAIT);
    expect(surface).toHaveValue('');
    fireEvent.change(surface, { target: { value: '150' } });
    fireEvent.click(screen.getByLabelText('Normal'));
    expect((await screen.findAllByText('15 000 F CFA', { exact: false }, WAIT)).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer les mesures seulement' }));
    expect(await screen.findByText(/Mesures enregistrées/)).toBeInTheDocument();
    expect(calls.find((call) => call.method === 'PUT')?.body).toEqual({
      answers: { surface: 150, condition: 'normal' },
      frequency: 'once',
    });
    expect(screen.getByText('2 écarts avec la demande du client.')).toBeInTheDocument();
  });
});
