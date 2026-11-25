import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { session } from '@/lib/api';
import { sessionBody } from '@/lib/api/session.test-utils';
import {
  ADMIN,
  cleaningType,
  errorBody,
  ids,
  offer,
  ok,
  page,
  parameter,
  place,
  roomsParameter,
  stateParameter,
  stubGateway,
} from '@/features/cleaning/fake-gateway.test-utils';
import { cleaningRequest, requestIds, visit } from '@/features/cleaning/requests-fixtures.test-utils';
import { RequestDetail } from './request-detail';

const REQUEST = `${ADMIN}/requests/${requestIds.request}`;
const AGENTS = `${ADMIN}/agents`;

beforeEach(() => session.set(sessionBody(['cleaning_supervisor'])));
afterEach(() => vi.unstubAllGlobals());

/** Dossier à l'étape « visite à planifier » : frais payés, aucune visite, rien de retenu. */
const toSchedule = (overrides: Record<string, unknown> = {}) =>
  cleaningRequest({
    status: 'visit_to_schedule',
    visits: [],
    retained: null,
    quoteHistory: [],
    ...overrides,
  });

const agent = (overrides: Record<string, unknown> = {}) => ({
  id: requestIds.agent,
  userId: requestIds.customer,
  status: 'active',
  firstName: 'Koffi',
  lastName: 'TEST',
  zoneKeys: ['cotonou'],
  ...overrides,
});

/** Catalogue lu pour saisir un constat : paramètres, lieu, offres, types. */
const catalog = {
  [`GET ${ADMIN}/parameters`]: page([parameter(), roomsParameter(), stateParameter()]),
  [`GET ${ADMIN}/place-types/${ids.place}`]: ok(place()),
  [`GET ${ADMIN}/offers`]: page([offer()]),
  [`GET ${ADMIN}/cleaning-types`]: page([cleaningType()]),
};

describe('fiche dossier : demande et visite', () => {
  it('affiche la demande, la frise et l’action suivante', async () => {
    stubGateway({ [`GET ${REQUEST}`]: ok(toSchedule()) });
    render(<RequestDetail id={requestIds.request} />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Dossier DN-000124' })).toBeInTheDocument();
    const steps = screen.getByRole('navigation', { name: 'Étapes du dossier' });
    expect(within(steps).getByRole('link', { current: 'step' })).toHaveTextContent('Visite');
    expect(within(steps).getByRole('link', { name: /Demande, terminée/ })).toBeInTheDocument();
    expect(screen.getByText('Planifier la visite du lieu.')).toBeInTheDocument();
    expect(screen.getByText('Afi TEST')).toBeInTheDocument();
    expect(screen.getByText('Derrière la pharmacie TEST')).toBeInTheDocument();
    expect(screen.getByText('150 m²')).toBeInTheDocument();
    expect(screen.getByText('Payés')).toBeInTheDocument();
    expect(screen.getByText(/^5\s000\sF\sCFA$/)).toBeInTheDocument();
  });

  it('planifie la visite avec un agent de la liste, puis relit le dossier', async () => {
    const { calls } = stubGateway({
      [`GET ${REQUEST}`]: [
        ok(toSchedule()),
        ok(
          cleaningRequest({ status: 'visit_scheduled', visits: [visit()], retained: null, quoteHistory: [] }),
        ),
      ],
      [`GET ${AGENTS}`]: page([
        agent(),
        agent({ id: requestIds.other, firstName: 'Ama', zoneKeys: ['porto-novo'] }),
      ]),
      [`POST ${ADMIN}/visits`]: ok(visit()),
    });
    render(<RequestDetail id={requestIds.request} />);
    const form = await screen.findByRole('form', { name: 'Planifier la visite' });
    const select = await within(form).findByLabelText('Agent');
    expect(within(select).getByRole('option', { name: 'Ama TEST (hors commune)' })).toBeInTheDocument();
    fireEvent.click(within(form).getByRole('button', { name: 'Planifier' }));
    expect(
      await within(form).findByText('Choisissez un agent ou laissez la planification le proposer.'),
    ).toBeInTheDocument();

    fireEvent.change(select, { target: { value: requestIds.agent } });
    fireEvent.click(within(form).getByRole('button', { name: 'Planifier' }));
    expect(
      await screen.findByText('Visite planifiée : en attente du passage de l’agent.'),
    ).toBeInTheDocument();
    const post = calls.find((call) => call.method === 'POST');
    expect(post?.body).toEqual({
      requestId: requestIds.request,
      scheduledAt: '2026-11-28T08:00:00.000Z',
      agentIds: [requestIds.agent],
      leadAgentId: requestIds.agent,
    });
    expect(post?.headers['Idempotency-Key']).toBeTruthy();
    expect(new URLSearchParams(calls.find((call) => call.path === AGENTS)?.search).get('status')).toBe(
      'active',
    );
  });

  it('erreur métier du contrat à la planification : message de la gateway', async () => {
    stubGateway({
      [`GET ${REQUEST}`]: ok(toSchedule()),
      [`GET ${AGENTS}`]: page([agent()]),
      [`POST ${ADMIN}/visits`]: {
        status: 422,
        body: errorBody('CLEANING_VISIT_FEE_UNPAID', 'Les frais de visite ne sont pas encore payés.'),
      },
    });
    render(<RequestDetail id={requestIds.request} />);
    const form = await screen.findByRole('form', { name: 'Planifier la visite' });
    fireEvent.change(await within(form).findByLabelText('Agent'), { target: { value: requestIds.agent } });
    fireEvent.click(within(form).getByRole('button', { name: 'Planifier' }));
    expect(
      await within(form).findByText('Les frais de visite ne sont pas encore payés.'),
    ).toBeInTheDocument();
  });

  it('clôture la visite pour l’agent : motif et constat obligatoires', async () => {
    const scheduled = cleaningRequest({
      status: 'visit_scheduled',
      visits: [visit()],
      retained: null,
      quoteHistory: [],
    });
    const { calls } = stubGateway({
      [`GET ${REQUEST}`]: [ok(scheduled), ok(cleaningRequest({ quoteHistory: [] }))],
      ...catalog,
      [`POST ${ADMIN}/visits/${requestIds.visit}/complete`]: ok(visit({ status: 'completed' })),
    });
    render(<RequestDetail id={requestIds.request} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Clôturer pour l’agent' }));
    const form = await screen.findByRole('form', { name: 'Clôturer la visite pour l’agent' });
    const area = await within(form).findByLabelText('Superficie (m²)');
    fireEvent.click(within(form).getByRole('button', { name: 'Clôturer la visite' }));
    expect(await within(form).findByText('Corrigez les champs signalés.')).toBeInTheDocument();
    expect(calls.some((call) => call.method === 'POST')).toBe(false);

    fireEvent.change(area, { target: { value: '160' } });
    fireEvent.change(within(form).getByLabelText('État des lieux'), { target: { value: 'normal' } });
    fireEvent.change(within(form).getByLabelText('Motif'), { target: { value: 'Agent sans réseau' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Clôturer la visite' }));
    await waitFor(() => expect(screen.queryByRole('form', { name: /Clôturer/ })).not.toBeInTheDocument());
    const post = calls.find((call) => call.method === 'POST');
    expect(post?.body).toMatchObject({
      reason: 'Agent sans réseau',
      values: { superficie: 160, etat: 'normal' },
    });
    expect(typeof (post?.body as { completedAt: string }).completedAt).toBe('string');
  });

  it('refuse le dossier après confirmation, motif obligatoire', async () => {
    const { calls } = stubGateway({
      [`GET ${REQUEST}`]: ok(toSchedule()),
      [`POST ${REQUEST}/reject`]: ok(toSchedule({ status: 'rejected' })),
    });
    render(<RequestDetail id={requestIds.request} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Refuser le dossier' }));
    const dialog = screen.getByRole('dialog', { name: 'Refuser ce dossier ?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Refuser le dossier' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Motif communiqué : Champ obligatoire.',
    );
    fireEvent.change(within(dialog).getByLabelText('Raison'), { target: { value: 'place_inaccessible' } });
    fireEvent.change(within(dialog).getByLabelText('Motif communiqué'), { target: { value: 'Accès fermé' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Refuser le dossier' }));
    expect(await screen.findByText('Dossier clos : aucune action attendue.')).toBeInTheDocument();
    expect(calls.at(-1)?.body).toEqual({ reasonCode: 'place_inaccessible', reason: 'Accès fermé' });
  });
});

describe('fiche dossier : droits', () => {
  it('support : lecture seule, aucune action d’écriture', async () => {
    session.set(sessionBody(['support_agent']));
    stubGateway({ [`GET ${REQUEST}`]: ok(toSchedule()) });
    render(<RequestDetail id={requestIds.request} />);
    expect(await screen.findByText(/Lecture seule/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Refuser le dossier' })).not.toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Planifier la visite' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Corriger la position' })).not.toBeInTheDocument();
  });

  it('rôle sans `cleaning.request.read` : aucun appel ; dossier introuvable', async () => {
    session.set(sessionBody(['finance_agent']));
    const { calls } = stubGateway({});
    const { unmount } = render(<RequestDetail id={requestIds.request} />);
    expect(await screen.findByText('Votre rôle ne donne pas accès à cet écran.')).toBeInTheDocument();
    expect(calls).toHaveLength(0);
    unmount();

    session.set(sessionBody(['cleaning_supervisor']));
    stubGateway({
      [`GET ${REQUEST}`]: { status: 404, body: errorBody('CLEANING_REQUEST_NOT_FOUND', 'Introuvable.') },
    });
    render(<RequestDetail id={requestIds.request} />);
    expect(await screen.findByText(/Élément introuvable/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Retour aux dossiers' })).toHaveAttribute('href', '/nettoyage');
  });
});
