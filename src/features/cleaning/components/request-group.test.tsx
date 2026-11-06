import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { session } from '@/lib/api';
import { sessionBody } from '@/lib/api/session.test-utils';
import { forgetServiceNames } from '@/features/cleaning/api';
import {
  agent,
  errorBody,
  groupedRequest,
  groupId,
  groupOutcome,
  ids,
  location,
  quoteRequest,
  SERVICES,
  stubGateway,
  visit,
} from '@/features/cleaning/fake-gateway.test-utils';
import { GroupDetail } from './group-detail';
import { RequestDetail } from './request-detail';
import { RequestsList } from './requests-list';
import { VisitsList } from './visits-list';

let search = '';
const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/nettoyage',
  useSearchParams: () => new URLSearchParams(search),
}));

const ADMIN = '/api/v1/admin/cleaning';
const REQUEST = `${ADMIN}/quote-requests/${ids.request}`;
const GROUP = `${ADMIN}/quote-request-groups/${groupId}`;
const SIBLING = '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d1002';
const PUBLIC_SERVICES = 'GET /api/v1/cleaning/services';
const AGENTS = { [`GET ${ADMIN}/agents`]: { status: 200, body: { data: [agent()] } } };

/** Formulaire public de la prestation TEST : libellés des réponses (`CleaningServiceForm`). */
const SERVICES_WITH_FORM = {
  status: 200,
  body: {
    data: [
      {
        code: 'house_cleaning',
        name: 'Nettoyage de maison TEST',
        description: '',
        unit: 'square_meter',
        options: [],
        priced: true,
        minimumPrice: null,
        form: {
          fields: [
            {
              code: 'surface',
              label: 'Superficie',
              type: 'number',
              required: true,
              helpText: null,
              unitLabel: 'm²',
              min: 1,
              max: 5000,
              choices: [],
            },
            {
              code: 'condition',
              label: 'État du logement',
              type: 'choice',
              required: true,
              helpText: null,
              unitLabel: null,
              min: null,
              max: null,
              choices: [{ code: 'dirty', label: 'Très sale' }],
            },
          ],
          options: [
            {
              code: 'windows',
              label: 'Vitres',
              description: null,
              fields: [
                {
                  code: 'window_count',
                  label: 'Nombre de fenêtres',
                  type: 'number',
                  required: true,
                  helpText: null,
                  unitLabel: 'fenêtres',
                  min: 1,
                  max: 100,
                  choices: [],
                },
              ],
            },
          ],
          frequencies: [{ code: 'once', label: 'Une fois' }],
        },
      },
    ],
  },
};

const sibling = (overrides: Record<string, unknown> = {}) =>
  groupedRequest({ id: SIBLING, serviceCode: 'window_cleaning', serviceName: 'Vitres TEST', ...overrides });

beforeEach(() => {
  search = '';
  replace.mockReset();
  forgetServiceNames();
  session.set(sessionBody(['cleaning_supervisor']));
});

afterEach(() => vi.unstubAllGlobals());

describe('fiche dossier d’une demande', () => {
  it('bandeau d’étapes, lieu et position avec lien carte, réponses lisibles et prix annoncé', async () => {
    stubGateway({
      [PUBLIC_SERVICES]: SERVICES_WITH_FORM,
      [`GET ${REQUEST}`]: { status: 200, body: groupedRequest({ groupSize: 1, groupId: null }) },
      [`POST ${REQUEST}/estimate`]: {
        status: 200,
        body: {
          requestId: ids.request,
          serviceCode: 'house_cleaning',
          commune: 'Cotonou',
          calculation: groupedRequest().calculation,
        },
      },
      ...AGENTS,
    });
    render(<RequestDetail id={ids.request} />);
    const banner = await screen.findByRole('navigation', { name: 'Avancement du dossier' });
    expect(
      within(banner)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual([
      '✓Demande, terminéeterminée',
      '2Visite et mesures, en coursen cours',
      '3Devis, à venirà venir',
      '4Mission, à venirà venir',
      '5Paiement, à venirà venir',
    ]);
    expect(within(banner).getByRole('link', { current: 'step' })).toHaveTextContent('Visite et mesures');
    // Seule l'étape en cours est dépliée.
    expect(document.getElementById('etape-visit')).toHaveAttribute('open');
    expect(document.getElementById('etape-request')).not.toHaveAttribute('open');
    expect(screen.getByRole('button', { name: 'Planifier la visite' })).toBeInTheDocument();
    expect(screen.getAllByText('Maison TEST').length).toBeGreaterThan(0);
    expect(screen.getByText('Portail vert, face à l’école TEST')).toBeInTheDocument();
    expect(screen.getByText('Rue 12, Akpakpa, Cotonou')).toBeInTheDocument();
    expect(screen.getByText('Latitude 6,3703, longitude 2,3912')).toBeInTheDocument();
    expect(screen.getByText(/± 8 m/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Voir sur la carte/ })).toHaveAttribute(
      'href',
      'https://www.google.com/maps/search/?api=1&query=6.3703,2.3912',
    );
    expect(await screen.findByText('120 m²')).toBeInTheDocument();
    expect(screen.getAllByText('Très sale').length).toBeGreaterThan(0);
    expect(screen.getByText('Option : Vitres')).toBeInTheDocument();
    expect(screen.getByText('6 fenêtres')).toBeInTheDocument();
    expect(screen.getAllByText('Grille version 3').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Cotonou : × 1,15').length).toBeGreaterThan(0);
  });

  it('demande au nouveau format : réponses lisibles, sans « Type de locaux » ni « Quantité »', async () => {
    stubGateway({
      [PUBLIC_SERVICES]: SERVICES,
      [`GET ${REQUEST}`]: {
        status: 200,
        body: groupedRequest({
          groupSize: 1,
          groupId: null,
          answerSummary: {
            fields: [
              {
                code: 'rooms',
                label: 'Nombre de pièces',
                type: 'number',
                value: 6,
                display: '6 pièces',
                unitLabel: 'pièces',
              },
              {
                code: 'pets',
                label: 'Présence d’animaux',
                type: 'boolean',
                value: false,
                display: 'Non',
                unitLabel: null,
              },
            ],
            options: [],
            frequency: { code: 'once', label: 'Une fois' },
          },
        }),
      },
      ...AGENTS,
    });
    render(<RequestDetail id={ids.request} />);
    expect(await screen.findByText('6 pièces')).toBeInTheDocument();
    expect(screen.getByText('Présence d’animaux')).toBeInTheDocument();
    expect(screen.getByText('Nettoyage de maison TEST', { selector: 'dd' })).toBeInTheDocument();
    expect(screen.queryByText('Type de locaux')).not.toBeInTheDocument();
    expect(screen.queryByText('Quantité', { selector: 'dt' })).not.toBeInTheDocument();
  });

  it('une demande d’un groupe mène au groupe ; la planifier seule avertit qu’elle se détache', async () => {
    stubGateway({
      [PUBLIC_SERVICES]: SERVICES,
      [`GET ${REQUEST}`]: { status: 200, body: groupedRequest() },
      ...AGENTS,
    });
    render(<RequestDetail id={ids.request} />);
    expect(await screen.findByText(/fait partie d’un groupe de 2 demandes/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Planifier la visite commune' })).toHaveAttribute(
      'href',
      `/nettoyage/demandes/groupes/${groupId}`,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Planifier cette demande seule' }));
    expect(
      within(screen.getByRole('dialog')).getByText(/la détache de la visite commune/),
    ).toBeInTheDocument();
  });

  it('devis envoyé : aucune action principale, renvoi en action secondaire', async () => {
    stubGateway({
      [PUBLIC_SERVICES]: SERVICES,
      [`GET ${REQUEST}`]: {
        status: 200,
        body: quoteRequest({ status: 'quote_sent', visit: visit({ status: 'completed' }), quote: null }),
      },
      ...AGENTS,
    });
    render(<RequestDetail id={ids.request} />);
    expect(await screen.findByText('Devis envoyé : en attente de la réponse du client.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Renvoyer un devis' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Établir le devis' })).not.toBeInTheDocument();
  });

  it('403 : une note ; 404 : introuvable, sans « Réessayer »', async () => {
    stubGateway({
      [PUBLIC_SERVICES]: SERVICES,
      [`GET ${REQUEST}`]: [
        { status: 403, body: errorBody('FORBIDDEN', 'Accès refusé.') },
        { status: 404, body: errorBody('CLEANING_REQUEST_NOT_FOUND', 'Introuvable.') },
      ],
      ...AGENTS,
    });
    const { unmount } = render(<RequestDetail id={ids.request} />);
    expect(await screen.findByText(/Votre rôle ne permet pas/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Réessayer' })).not.toBeInTheDocument();
    unmount();
    render(<RequestDetail id={ids.request} />);
    expect(await screen.findByText(/Demande introuvable/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Toutes les demandes' })).toBeInTheDocument();
  });

  it('erreur serveur : message, référence et « Réessayer »', async () => {
    stubGateway({
      [PUBLIC_SERVICES]: SERVICES,
      [`GET ${REQUEST}`]: [
        { status: 500, body: errorBody('INTERNAL', 'Erreur du serveur.') },
        { status: 200, body: quoteRequest() },
      ],
      ...AGENTS,
    });
    render(<RequestDetail id={ids.request} />);
    expect(await screen.findByText(/Erreur du serveur\. Référence pour le support/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
  });
});

describe('envoi du devis d’une demande', () => {
  const ready = quoteRequest({
    status: 'visit_scheduled',
    visit: visit({ status: 'completed', report: 'ok' }),
    calculation: groupedRequest().calculation,
  });

  it('récapitulatif et estimation du serveur, puis relecture de la fiche après une coupure réseau', async () => {
    const { calls, fetchMock } = stubGateway({
      [PUBLIC_SERVICES]: SERVICES,
      [`GET ${REQUEST}`]: { status: 200, body: ready },
      ...AGENTS,
    });
    const original = fetchMock.getMockImplementation();
    fetchMock.mockImplementation(async (input, init) => {
      if (String(input).endsWith('/quote')) throw new TypeError('Failed to fetch');
      return original!(input, init);
    });
    render(<RequestDetail id={ids.request} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Établir le devis' }));
    expect(await screen.findByText(/Prix d’un passage estimé : 13\s800/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Vérifier avant l’envoi' }));
    const dialog = screen.getByRole('dialog', { name: 'Envoyer — le prix est figé à l’envoi' });
    expect(
      within(dialog).getByText('Préremplies depuis le calcul des mesures (ou de la demande)'),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(/Sans ligne saisie, le devis reprend ce calcul/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Envoyer le devis' }));
    expect(await within(dialog).findByText(/la fiche a été relue/)).toBeInTheDocument();
    await waitFor(() =>
      expect(calls.filter((call) => call.method === 'GET' && call.path === REQUEST)).toHaveLength(2),
    );
  });
});

describe('correction de la position', () => {
  it('envoie la position saisie et annonce les dossiers mis à jour', async () => {
    const { calls } = stubGateway({
      [PUBLIC_SERVICES]: SERVICES,
      [`GET ${REQUEST}`]: { status: 200, body: groupedRequest() },
      [`PUT ${REQUEST}/location`]: [
        {
          status: 422,
          body: errorBody('CLEANING_ZONE_NOT_COVERED', 'Cette commune n’est pas desservie.'),
        },
        {
          status: 200,
          body: {
            request: groupedRequest({ landmark: 'Portail bleu' }),
            updatedRequestIds: [ids.request, SIBLING],
            updatedMissionIds: [ids.mission],
          },
        },
      ],
      ...AGENTS,
    });
    render(<RequestDetail id={ids.request} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Corriger la position' }));
    const dialog = screen.getByRole('dialog', { name: 'Corriger la position du lieu' });
    expect(within(dialog).getByLabelText(/^Latitude/)).toHaveValue('6.3703');
    fireEvent.change(within(dialog).getByLabelText(/^Latitude/), { target: { value: '95' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer la position' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('entre −90 et 90');
    expect(calls.some((call) => call.method === 'PUT')).toBe(false);

    fireEvent.change(within(dialog).getByLabelText(/^Latitude/), { target: { value: '6,3710' } });
    fireEvent.change(within(dialog).getByLabelText(/^Repère/), { target: { value: 'Portail bleu' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer la position' }));
    expect(await within(dialog).findByText('Cette commune n’est pas desservie.')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer la position' }));
    expect(
      await screen.findByText('Position enregistrée : 2 demandes et 1 mission mises à jour.'),
    ).toBeInTheDocument();
    expect(calls.filter((call) => call.method === 'PUT').at(-1)?.body).toEqual({
      latitude: 6.371,
      longitude: 2.3912,
      accuracyMeters: 8,
      landmark: 'Portail bleu',
    });
  });

  it('reprend la position du téléphone (géolocalisation du navigateur)', async () => {
    stubGateway({
      [PUBLIC_SERVICES]: SERVICES,
      [`GET ${REQUEST}`]: { status: 200, body: quoteRequest() },
      ...AGENTS,
    });
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (success: PositionCallback) =>
          success({ coords: { latitude: 6.5, longitude: 2.6, accuracy: 12.4 } } as GeolocationPosition),
      },
    });
    onTestFinished(() => {
      Reflect.deleteProperty(navigator, 'geolocation');
    });
    render(<RequestDetail id={ids.request} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Corriger la position' }));
    const dialog = screen.getByRole('dialog', { name: 'Corriger la position du lieu' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Utiliser ma position actuelle' }));
    expect(within(dialog).getByLabelText(/^Latitude/)).toHaveValue('6.5');
    expect(within(dialog).getByLabelText(/^Précision/)).toHaveValue('12');
    expect(within(dialog).getByText(/précision ± 12 m/)).toBeInTheDocument();
  });
});

describe('vue d’un groupe', () => {
  const GROUP_LIST = `GET ${ADMIN}/quote-requests`;

  it('lit le groupe par la liste filtrée et planifie la visite commune avec une clé gardée au renvoi', async () => {
    const scheduled = [
      groupedRequest({ status: 'visit_scheduled', visit: visit({ groupVisitId: ids.visit }) }),
      sibling(),
    ];
    const { calls } = stubGateway({
      [GROUP_LIST]: { status: 200, body: { data: [groupedRequest(), sibling()], nextCursor: null } },
      [`POST ${GROUP}/visits`]: [
        { status: 503, body: errorBody('GATEWAY_UNAVAILABLE', 'Service indisponible.') },
        {
          status: 200,
          body: groupOutcome(scheduled, {
            affectedRequestIds: [ids.request],
            groupVisitId: ids.visit,
            skipped: [{ requestId: SIBLING, status: 'received', reason: 'excluded' }],
          }),
        },
      ],
      ...AGENTS,
    });
    render(<GroupDetail groupId={groupId} />);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Groupe de 2 demandes' }),
    ).toBeInTheDocument();
    expect(calls.find((call) => call.path.endsWith('/quote-requests'))?.search).toBe(
      `?limit=10&groupId=${groupId}`,
    );
    expect(screen.getByText(/Pas de total de groupe/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Planifier la visite commune' }));
    const dialog = screen.getByRole('dialog', { name: 'Visite commune du groupe' });
    fireEvent.change(within(dialog).getByLabelText(/Date et heure/), {
      target: { value: '2026-11-10T09:00' },
    });
    fireEvent.change(within(dialog).getByLabelText('Agent'), { target: { value: ids.agent } });
    fireEvent.click(within(dialog).getByLabelText('Vitres TEST'));
    const confirm = () =>
      fireEvent.click(within(dialog).getByRole('button', { name: 'Planifier la visite commune' }));
    confirm();
    expect(await within(dialog).findByText(/Service indisponible/)).toBeInTheDocument();
    confirm();
    expect(await screen.findByText(/Visite commune planifiée\. 1 demande modifiée\./)).toBeInTheDocument();
    expect(screen.getByText('Vitres TEST : exclue de la visite commune')).toBeInTheDocument();

    const posts = calls.filter((call) => call.path === `${GROUP}/visits`);
    expect(posts.at(-1)?.body).toEqual({
      scheduledAt: '2026-11-10T08:00:00.000Z',
      agentId: ids.agent,
      excludeRequestIds: [SIBLING],
    });
    const keys = posts.map((call) => call.headers['Idempotency-Key']);
    expect(keys[0]).toMatch(/^[A-Za-z0-9_-]{8,100}$/);
    expect(new Set(keys).size).toBe(1);
    // La visite commune planifiée, le compte rendu commun devient l'action principale.
    expect(
      screen.getByRole('button', { name: 'Saisir le compte rendu commun et les mesures' }),
    ).toBeInTheDocument();
  });

  it('devis groupés : erreur « tout ou rien » qui nomme la demande, puis envoi', async () => {
    const visited = { status: 'visit_scheduled', visit: visit({ status: 'completed', report: 'ok' }) };
    const { calls } = stubGateway({
      [GROUP_LIST]: {
        status: 200,
        body: { data: [groupedRequest(visited), sibling(visited)], nextCursor: null },
      },
      [`POST ${GROUP}/quotes`]: [
        {
          status: 422,
          body: errorBody('CLEANING_PRICE_NOT_SET', 'Le prix n’est pas fixé.', { requestId: SIBLING }),
        },
        {
          status: 200,
          body: groupOutcome([groupedRequest({ status: 'quote_sent' }), sibling({ status: 'quote_sent' })]),
        },
      ],
      ...AGENTS,
    });
    render(<GroupDetail groupId={groupId} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Établir les devis groupés' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Vérifier avant l’envoi' }));
    const dialog = screen.getByRole('dialog', { name: 'Envoyer les devis — les prix sont figés à l’envoi' });
    const send = () => fireEvent.click(within(dialog).getByRole('button', { name: 'Envoyer les 2 devis' }));
    send();
    expect(
      await within(dialog).findByText('Demande « Vitres TEST » : Le prix n’est pas fixé.'),
    ).toBeInTheDocument();
    send();
    expect(await screen.findByText(/Devis envoyés au client\./)).toBeInTheDocument();
    const posts = calls.filter((call) => call.path === `${GROUP}/quotes`);
    expect(posts[0]?.body).toEqual({
      proposedSlots: [{ start: '2026-11-05T08:00:00.000Z', end: '2026-11-05T11:00:00.000Z' }],
      quotes: [
        { requestId: ids.request, durationMinutes: 180, teamSize: 2 },
        { requestId: SIBLING, durationMinutes: 180, teamSize: 2 },
      ],
    });
    expect(posts[0]?.headers['Idempotency-Key']).toBe(posts[1]?.headers['Idempotency-Key']);
  });

  it('refus du groupe avec motif ; groupe vide : introuvable', async () => {
    const { calls } = stubGateway({
      [GROUP_LIST]: [
        {
          status: 200,
          body: { data: [groupedRequest(), sibling({ status: 'quote_sent' })], nextCursor: null },
        },
        { status: 200, body: { data: [], nextCursor: null } },
      ],
      [`POST ${GROUP}/reject`]: {
        status: 200,
        body: groupOutcome([groupedRequest({ status: 'rejected' }), sibling({ status: 'quote_sent' })], {
          affectedRequestIds: [ids.request],
          skipped: [{ requestId: SIBLING, status: 'quote_sent', reason: 'transition_not_allowed' }],
        }),
      },
      ...AGENTS,
    });
    const { unmount } = render(<GroupDetail groupId={groupId} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Refuser le groupe' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/^Motif/), { target: { value: 'Hors zone' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Refuser le groupe' }));
    expect(await screen.findByText('Vitres TEST : son état ne le permet pas')).toBeInTheDocument();
    expect(calls.find((call) => call.path === `${GROUP}/reject`)?.body).toEqual({ reason: 'Hors zone' });
    unmount();
    render(<GroupDetail groupId={groupId} />);
    expect(await screen.findByText(/il est introuvable/)).toBeInTheDocument();
  });
});

describe('liste et visites : filtres du groupe, du lieu et de la prestation', () => {
  it('passe lieu, prestation et groupe à la gateway et mène au groupe par son badge', async () => {
    search = `lieu=house&prestation=house_cleaning&groupe=${groupId}`;
    const { calls } = stubGateway({
      [PUBLIC_SERVICES]: SERVICES,
      'GET /api/v1/cleaning/zones': { status: 200, body: { data: [] } },
      'GET /api/v1/cleaning/catalog': {
        status: 200,
        body: {
          placeTypes: [
            {
              code: 'house',
              label: 'Maison TEST',
              description: null,
              icon: 'house',
              displayOrder: 1,
              serviceCodes: [],
            },
          ],
          services: [],
        },
      },
      [`GET ${ADMIN}/quote-requests`]: { status: 200, body: { data: [groupedRequest()], nextCursor: null } },
    });
    render(<RequestsList />);
    expect(
      await screen.findByRole('link', { name: 'Voir le groupe de 2 demandes pour ce lieu' }),
    ).toHaveAttribute('href', `/nettoyage/demandes/groupes/${groupId}`);
    expect(calls.find((call) => call.path.endsWith('/quote-requests'))?.search).toBe(
      `?limit=20&groupId=${groupId}&placeType=house&serviceCode=house_cleaning`,
    );
    await waitFor(() => expect(screen.getByLabelText('Type de lieu')).toHaveDisplayValue('Maison TEST'));
    fireEvent.click(screen.getByRole('button', { name: 'Retirer le filtre du groupe' }));
    expect(replace).toHaveBeenCalledWith('/nettoyage?lieu=house&prestation=house_cleaning', {
      scroll: false,
    });
  });

  it('visites : filtre du groupe et compte rendu commun avec clé d’idempotence', async () => {
    search = `groupe=${groupId}`;
    const groupVisit = {
      id: ids.visit,
      groupVisitId: ids.visit,
      groupId,
      status: 'scheduled',
      scheduledAt: '2026-11-10T08:00:00Z',
      completedAt: null,
      report: null,
      agentId: ids.agent,
      agentName: 'Agent TEST',
      customerId: ids.customer,
      customerName: 'Client TEST',
      organizationName: null,
      commune: 'Cotonou',
      address: 'Portail vert',
      location,
      landmark: 'Portail vert',
      geocodedAddress: null,
      placeType: 'house',
      placeTypeLabel: 'Maison TEST',
      requests: [
        {
          requestId: ids.request,
          visitId: ids.visit,
          serviceCode: 'house_cleaning',
          serviceName: 'Maison',
          status: 'visit_scheduled',
        },
        {
          requestId: SIBLING,
          visitId: ids.quote,
          serviceCode: 'window_cleaning',
          serviceName: 'Vitres',
          status: 'visit_scheduled',
        },
      ],
    };
    const { calls } = stubGateway({
      [`GET ${ADMIN}/visits`]: { status: 200, body: { data: [groupVisit], nextCursor: null } },
      [`POST ${GROUP}/visits/complete`]: { status: 200, body: groupOutcome([]) },
    });
    render(<VisitsList />);
    fireEvent.click(await screen.findByRole('button', { name: 'Compte rendu commun : Client TEST' }));
    expect(calls.find((call) => call.path.endsWith('/visits'))?.search).toBe(`?limit=20&groupId=${groupId}`);
    const dialog = screen.getByRole('dialog', { name: 'Compte rendu commun de la visite' });
    fireEvent.change(within(dialog).getByLabelText(/Constats/), { target: { value: 'Tout vu.' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer le compte rendu commun' }));
    expect(await screen.findByText('Compte rendu commun enregistré : Client TEST.')).toBeInTheDocument();
    const post = calls.find((call) => call.path === `${GROUP}/visits/complete`);
    expect(post?.body).toEqual({ report: 'Tout vu.' });
    expect(post?.headers['Idempotency-Key']).toMatch(/^[A-Za-z0-9_-]{8,100}$/);
  });
});
