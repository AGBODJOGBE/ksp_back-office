import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { session } from '@/lib/api';
import { sessionBody } from '@/lib/api/session.test-utils';
import {
  errorBody,
  ids,
  quoteRequest,
  stubGateway,
  visit,
} from '@/features/cleaning/fake-gateway.test-utils';
import { measurableFromVisit, VisitsList } from './visits-list';

let search = '';
const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/nettoyage/visites',
  useSearchParams: () => new URLSearchParams(search),
}));

const VISITS = '/api/v1/admin/cleaning/visits';
const SECOND_REQUEST = '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d1002';
const SECOND_VISIT = '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d4002';

/** `CleaningVisit` du contrat : visite commune à deux demandes (une visite par demande). */
function cleaningVisit(overrides: Record<string, unknown> = {}) {
  return {
    id: ids.visit,
    groupVisitId: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d4100',
    groupId: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d1100',
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
    address: 'Rue 12, Akpakpa',
    location: null,
    landmark: 'Près du marché',
    geocodedAddress: null,
    placeType: 'house',
    placeTypeLabel: 'Maison',
    requests: [
      {
        requestId: ids.request,
        visitId: ids.visit,
        serviceCode: 'menage_test',
        serviceName: 'Ménage',
        status: 'visit_scheduled',
      },
      {
        requestId: SECOND_REQUEST,
        visitId: SECOND_VISIT,
        serviceCode: 'vitres',
        serviceName: 'Vitres',
        status: 'visit_scheduled',
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  search = '';
  replace.mockReset();
  session.set(sessionBody(['cleaning_supervisor']));
});

afterEach(() => vi.unstubAllGlobals());

describe('visites techniques', () => {
  it('liste les visites, lie chaque demande pour la supervision et passe les filtres à la gateway', async () => {
    search = 'etat=scheduled&periode=passee';
    const { calls } = stubGateway({
      [`GET ${VISITS}`]: { status: 200, body: { data: [cleaningVisit()], nextCursor: null } },
    });
    render(<VisitsList />);
    expect(await screen.findByRole('link', { name: 'Voir la demande : Ménage' })).toHaveAttribute(
      'href',
      `/nettoyage/demandes/${ids.request}`,
    );
    expect(screen.getByRole('link', { name: 'Voir la demande : Vitres' })).toBeInTheDocument();
    expect(screen.getAllByText('Visite commune à plusieurs demandes').length).toBeGreaterThan(0);
    const query = new URLSearchParams(calls[0]?.search);
    expect(query.get('limit')).toBe('20');
    expect(query.get('status')).toBe('scheduled');
    expect(query.get('to')).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(query.get('from')).toBeNull();

    fireEvent.change(screen.getByLabelText('Période'), { target: { value: 'a-venir' } });
    expect(replace).toHaveBeenCalledWith('/nettoyage/visites?etat=scheduled&periode=a-venir', {
      scroll: false,
    });
  });

  it('l’agent saisit le compte rendu d’une demande sur la ligne, sans lien vers la fiche', async () => {
    session.set(sessionBody(['cleaning_agent']));
    const { calls } = stubGateway({
      [`GET ${VISITS}`]: [
        { status: 200, body: { data: [cleaningVisit({ address: null })], nextCursor: null } },
        { status: 200, body: { data: [], nextCursor: null } },
      ],
      [`POST ${VISITS}/${SECOND_VISIT}/complete`]: [
        {
          status: 422,
          body: errorBody('CLEANING_VISIT_TOO_EARLY', 'Trop tôt.', { scheduledAt: '2026-11-04T09:00:00Z' }),
        },
        {
          status: 200,
          body: quoteRequest({
            id: SECOND_REQUEST,
            status: 'visit_scheduled',
            visit: visit({ status: 'completed' }),
          }),
        },
      ],
    });
    render(<VisitsList />);
    await screen.findByText('Vitres');
    expect(screen.queryByRole('link', { name: /Voir la demande/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Compte rendu : Vitres, Koffi Adjovi' }));
    const dialog = screen.getByRole('dialog', { name: 'Compte rendu de la visite' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer le compte rendu' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Champ obligatoire.');

    fireEvent.change(within(dialog).getByLabelText('Constats de la visite'), {
      target: { value: 'Deux étages, accès facile.' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer le compte rendu' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      /La visite est prévue le .* : son compte rendu pourra être saisi à partir de cette heure\./,
    );

    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer le compte rendu' }));
    expect(await screen.findByText('Compte rendu enregistré : Vitres, Koffi Adjovi.')).toBeInTheDocument();
    const posts = calls.filter((call) => call.method === 'POST');
    expect(posts.map((call) => call.path)).toEqual([
      `${VISITS}/${SECOND_VISIT}/complete`,
      `${VISITS}/${SECOND_VISIT}/complete`,
    ]);
    expect(posts[1]?.body).toEqual({ report: 'Deux étages, accès facile.' });
    // La liste est relue.
    await waitFor(() => expect(calls.filter((call) => call.method === 'GET')).toHaveLength(2));
  });

  it('une visite réalisée n’a plus d’action', async () => {
    stubGateway({
      [`GET ${VISITS}`]: {
        status: 200,
        body: {
          data: [cleaningVisit({ status: 'completed', completedAt: '2026-11-04T10:00:00Z', report: 'RAS' })],
          nextCursor: null,
        },
      },
    });
    render(<VisitsList />);
    expect((await screen.findAllByText('Réalisée')).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /^Compte rendu/ })).not.toBeInTheDocument();
  });
});

describe('mesures de l’agent préremplies depuis sa visite (ADR-037)', () => {
  const base = {
    requestId: SECOND_REQUEST,
    visitId: SECOND_VISIT,
    serviceCode: 'house_cleaning',
    serviceName: 'Nettoyage de maison',
    status: 'visit_scheduled',
  };

  it('reprend les réponses du client et les mesures déjà saisies, sans montant inventé', () => {
    const request = measurableFromVisit({
      ...base,
      answers: { surface: 250, bedrooms: 4 },
      selectedOptions: [],
      frequency: 'once',
      calculation: null,
      measuredAnswers: { surface: 280, bedrooms: 4 },
    });
    expect(request).toMatchObject({
      answers: { surface: 250, bedrooms: 4 },
      measuredAnswers: { surface: 280, bedrooms: 4 },
      frequency: 'once',
      calculation: null,
    });
  });

  it('sans réponses (gateway antérieure) : formulaire vide', () => {
    expect(measurableFromVisit(base)).toBeNull();
  });
});
