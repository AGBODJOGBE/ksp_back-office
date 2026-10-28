import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { session } from '@/lib/api';
import { sessionBody } from '@/lib/api/session.test-utils';
import { forgetServiceNames } from '@/features/cleaning/api';
import {
  agent,
  errorBody,
  ids,
  intervention,
  mission,
  quoteRequest,
  SERVICES,
  stubGateway,
  visit,
  zone,
} from '@/features/cleaning/fake-gateway.test-utils';
import { InterventionScreen } from './intervention-screen';
import { MissionDetail } from './mission-detail';
import { RequestDetail } from './request-detail';
import { RequestsList } from './requests-list';
import { ZonesScreen } from './zones-screen';

let search = '';
const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/nettoyage',
  useSearchParams: () => new URLSearchParams(search),
}));

const ADMIN = '/api/v1/admin/cleaning';
const REQUEST = `${ADMIN}/quote-requests/${ids.request}`;
const MISSION = `${ADMIN}/missions/${ids.mission}`;
const PUBLIC_SERVICES = 'GET /api/v1/cleaning/services';
const AGENTS = { [`GET ${ADMIN}/agents`]: { status: 200, body: { data: [agent()] } } };

const plain = (value: string | null) => (value ?? '').replace(/\s/g, ' ');

beforeEach(() => {
  search = '';
  replace.mockReset();
  forgetServiceNames();
  session.set(sessionBody(['cleaning_admin']));
});

afterEach(() => vi.unstubAllGlobals());

describe('liste des demandes de devis', () => {
  it('affiche les demandes et demande l’état choisi à la gateway', async () => {
    search = 'etat=received';
    const { calls } = stubGateway({
      [PUBLIC_SERVICES]: SERVICES,
      [`GET ${ADMIN}/quote-requests`]: { status: 200, body: { data: [quoteRequest()], nextCursor: null } },
    });
    render(<RequestsList />);
    const link = await screen.findByRole('link', { name: /Demande du 28 oct\. 2026/ });
    expect(link).toHaveAttribute('href', `/nettoyage/demandes/${ids.request}`);
    expect(await screen.findByText('Prestation de test')).toBeInTheDocument();
    expect(calls.find((call) => call.path.endsWith('/quote-requests'))?.search).toBe(
      '?limit=20&status=received',
    );
    expect(screen.getByLabelText('État')).toHaveValue('received');
  });

  it('filtre les demandes chargées par commune, et l’annonce', async () => {
    search = 'commune=Porto-Novo';
    stubGateway({
      [PUBLIC_SERVICES]: SERVICES,
      [`GET ${ADMIN}/quote-requests`]: {
        status: 200,
        body: {
          data: [
            quoteRequest(),
            quoteRequest({ id: 'autre', commune: 'Porto-Novo', createdAt: '2026-10-27T09:00:00Z' }),
          ],
          nextCursor: null,
        },
      },
    });
    render(<RequestsList />);
    expect(await screen.findAllByRole('row')).toHaveLength(2); // en-tête + une demande
    expect(screen.getByText(/filtrent les demandes déjà chargées/)).toBeInTheDocument();
  });

  it('un agent de terrain est renvoyé vers ses missions', () => {
    session.set(sessionBody(['cleaning_agent']));
    stubGateway({});
    render(<RequestsList />);
    expect(screen.getByRole('link', { name: 'Missions' })).toHaveAttribute('href', '/nettoyage/missions');
  });
});

describe('fiche d’une demande', () => {
  it('propose la visite et le refus pour une demande reçue', async () => {
    stubGateway({
      [PUBLIC_SERVICES]: SERVICES,
      [`GET ${REQUEST}`]: { status: 200, body: quoteRequest() },
      ...AGENTS,
    });
    render(<RequestDetail id={ids.request} />);
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Demande');
    expect(screen.getByRole('button', { name: 'Planifier la visite' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refuser la demande' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Établir le devis' })).not.toBeInTheDocument();
  });

  it('refuse avec un motif obligatoire et affiche le refus de la gateway', async () => {
    const { calls } = stubGateway({
      [PUBLIC_SERVICES]: SERVICES,
      [`GET ${REQUEST}`]: { status: 200, body: quoteRequest() },
      [`POST ${REQUEST}/reject`]: [
        {
          status: 422,
          body: errorBody('CLEANING_INVALID_TRANSITION', 'Cette demande ne peut plus être refusée.'),
        },
        { status: 200, body: quoteRequest({ status: 'rejected', closingReason: 'Hors zone' }) },
      ],
      ...AGENTS,
    });
    render(<RequestDetail id={ids.request} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Refuser la demande' }));
    const dialog = screen.getByRole('dialog', { name: 'Refuser cette demande ?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Refuser la demande' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Indiquez un motif.');

    fireEvent.change(within(dialog).getByLabelText('Motif'), { target: { value: 'Hors zone' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Refuser la demande' }));
    expect(await within(dialog).findByText('Cette demande ne peut plus être refusée.')).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Refuser la demande' }));
    await waitFor(() => expect(screen.getAllByText('Refusée').length).toBeGreaterThan(0));
    expect(calls.filter((call) => call.path.endsWith('/reject')).map((call) => call.body)).toEqual([
      { reason: 'Hors zone' },
      { reason: 'Hors zone' },
    ]);
    expect(screen.getByText('Aucune action possible dans cet état.')).toBeInTheDocument();
  });

  it('demande le compte rendu tant que la visite est planifiée', async () => {
    const { calls } = stubGateway({
      [PUBLIC_SERVICES]: SERVICES,
      [`GET ${REQUEST}`]: { status: 200, body: quoteRequest({ status: 'visit_scheduled', visit: visit() }) },
      [`POST ${ADMIN}/visits/${ids.visit}/complete`]: {
        status: 200,
        body: quoteRequest({
          status: 'visit_scheduled',
          visit: visit({ status: 'completed', report: '4 pièces', completedAt: '2026-10-30T10:00:00Z' }),
        }),
      },
      ...AGENTS,
    });
    render(<RequestDetail id={ids.request} />);
    expect(await screen.findByText('Awa B.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Saisir le compte rendu' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Constats de la visite/), {
      target: { value: '4 pièces' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer le compte rendu' }));
    expect(await screen.findByRole('button', { name: 'Établir le devis' })).toBeInTheDocument();
    expect(calls.find((call) => call.path.endsWith('/complete'))?.body).toEqual({ report: '4 pièces' });
  });

  it('envoie le devis sans ligne (grille en vigueur) avec les créneaux du client', async () => {
    const { calls } = stubGateway({
      [PUBLIC_SERVICES]: SERVICES,
      [`GET ${REQUEST}`]: {
        status: 200,
        body: quoteRequest({
          status: 'visit_scheduled',
          visit: visit({ status: 'completed', report: 'ok' }),
        }),
      },
      [`POST ${REQUEST}/quote`]: {
        status: 422,
        body: errorBody('CLEANING_PRICE_NOT_SET', 'Le prix de cette prestation n’est pas encore fixé.'),
      },
      ...AGENTS,
    });
    render(<RequestDetail id={ids.request} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Établir le devis' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Envoyer le devis au client' }));
    expect(await screen.findByText('Le prix de cette prestation n’est pas encore fixé.')).toBeInTheDocument();
    expect(calls.find((call) => call.path.endsWith('/quote'))?.body).toEqual({
      proposedSlots: [{ start: '2026-11-05T08:00:00.000Z', end: '2026-11-05T11:00:00.000Z' }],
      durationMinutes: 180,
      teamSize: 2,
    });
  });
});

describe('fiche d’une mission', () => {
  it('propose le paiement manuel à un particulier et l’enregistre', async () => {
    const { calls } = stubGateway({
      [PUBLIC_SERVICES]: SERVICES,
      [`GET ${MISSION}`]: { status: 200, body: mission() },
      [`GET ${REQUEST}`]: { status: 200, body: quoteRequest({ status: 'accepted' }) },
      [`POST ${MISSION}/payments`]: {
        status: 200,
        body: mission({
          payment: { ...mission().payment, status: 'paid', paid: { amount: 10000, currency: 'XOF' } },
        }),
      },
    });
    render(<MissionDetail id={ids.mission} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Enregistrer un paiement' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Montant reçu (FCFA)'), { target: { value: '10000' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer le paiement' }));
    await waitFor(() => expect(screen.getAllByText('Réglé').length).toBeGreaterThan(0));
    expect(calls.find((call) => call.path.endsWith('/payments'))?.body).toEqual({
      amount: 10000,
      method: 'cash',
    });
    expect(screen.queryByRole('button', { name: 'Enregistrer un paiement' })).not.toBeInTheDocument();
  });

  it('garde le paiement manuel d’une mission terminée, sans planification ni annulation', async () => {
    stubGateway({
      [PUBLIC_SERVICES]: SERVICES,
      [`GET ${MISSION}`]: { status: 200, body: mission({ status: 'completed' }) },
      [`GET ${REQUEST}`]: { status: 200, body: quoteRequest({ status: 'accepted' }) },
    });
    render(<MissionDetail id={ids.mission} />);
    expect(await screen.findByRole('button', { name: 'Enregistrer un paiement' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Annuler la mission' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Planifier un passage' })).not.toBeInTheDocument();
  });

  it('ne propose pas de paiement manuel pour une entreprise (facture mensuelle)', async () => {
    stubGateway({
      [PUBLIC_SERVICES]: SERVICES,
      [`GET ${MISSION}`]: { status: 200, body: mission() },
      [`GET ${REQUEST}`]: {
        status: 200,
        body: quoteRequest({ customerKind: 'business', status: 'accepted' }),
      },
    });
    render(<MissionDetail id={ids.mission} />);
    expect(await screen.findByText(/se règle par sa facture mensuelle/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enregistrer un paiement' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Annuler la mission' })).toBeInTheDocument();
  });

  it('un agent de terrain voit ses passages sans les actions de supervision', async () => {
    session.set(sessionBody(['cleaning_agent']));
    stubGateway({ [PUBLIC_SERVICES]: SERVICES, [`GET ${MISSION}`]: { status: 200, body: mission() } });
    render(<MissionDetail id={ids.mission} />);
    expect(await screen.findByRole('link', { name: /Passage du 5 nov\. 2026/ })).toHaveAttribute(
      'href',
      `/nettoyage/missions/${ids.mission}/passages/${ids.intervention}`,
    );
    expect(screen.queryByRole('button', { name: 'Annuler la mission' })).not.toBeInTheDocument();
  });
});

describe('passage sur le terrain', () => {
  const START = `POST ${ADMIN}/interventions/${ids.intervention}/start`;
  const CHECKLIST = `PUT ${ADMIN}/interventions/${ids.intervention}/checklist`;
  const COMPLETE = `POST ${ADMIN}/interventions/${ids.intervention}/complete`;

  it('démarre, coche la liste de contrôle et affiche le refus de clôture', async () => {
    const running = mission({
      status: 'in_progress',
      interventions: [intervention({ status: 'in_progress' })],
    });
    const { calls } = stubGateway({
      [`GET ${MISSION}`]: { status: 200, body: mission() },
      [START]: { status: 200, body: running },
      [CHECKLIST]: {
        status: 200,
        body: mission({
          status: 'in_progress',
          interventions: [
            intervention({
              status: 'in_progress',
              checklist: [
                { code: 'arrival', label: 'Arrivée sur place', done: true },
                { code: 'cleaning_done', label: 'Nettoyage terminé', done: false },
              ],
            }),
          ],
        }),
      },
      [COMPLETE]: {
        status: 422,
        body: errorBody('CLEANING_CHECKLIST_INCOMPLETE', 'La liste de contrôle n’est pas complète.'),
      },
    });
    render(<InterventionScreen missionId={ids.mission} interventionId={ids.intervention} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Démarrer le passage' }));

    await screen.findByRole('button', { name: 'Clôturer le passage' });
    const arrival = screen.getByRole('checkbox', { name: /Arrivée sur place/ });
    fireEvent.click(arrival);
    await waitFor(() => expect(screen.getByRole('checkbox', { name: /Arrivée sur place/ })).toBeChecked());
    expect(calls.find((call) => call.method === 'PUT')?.body).toEqual({ doneCodes: ['arrival'] });

    fireEvent.click(screen.getByRole('button', { name: 'Clôturer le passage' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Clôturer' }));
    expect(await within(dialog).findByText('La liste de contrôle n’est pas complète.')).toBeInTheDocument();
    expect(screen.getByText(/L’envoi des photos n’est pas encore possible/)).toBeInTheDocument();
  });

  it('propose la reprise d’un passage en attente et montre l’incident', async () => {
    stubGateway({
      [`GET ${MISSION}`]: {
        status: 200,
        body: mission({
          status: 'on_hold',
          interventions: [intervention({ status: 'on_hold', incidentNote: 'Coupure d’eau' })],
        }),
      },
    });
    render(<InterventionScreen missionId={ids.mission} interventionId={ids.intervention} />);
    expect(await screen.findByRole('button', { name: 'Reprendre le passage' })).toBeInTheDocument();
    expect(screen.getByText('Coupure d’eau')).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox').every((box) => (box as HTMLInputElement).disabled)).toBe(true);
  });
});

describe('zones desservies', () => {
  it('désactive une zone après confirmation et réactive une zone fermée', async () => {
    const { calls } = stubGateway({
      [`GET ${ADMIN}/zones`]: {
        status: 200,
        body: { data: [zone(), zone({ code: 'porto-novo', commune: 'Porto-Novo', active: false })] },
      },
      [`POST ${ADMIN}/zones/cotonou/deactivate`]: { status: 200, body: zone({ active: false }) },
      [`POST ${ADMIN}/zones`]: { status: 200, body: zone({ code: 'porto-novo', commune: 'Porto-Novo' }) },
    });
    render(<ZonesScreen />);
    fireEvent.click(await screen.findByRole('button', { name: 'Désactiver Cotonou' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Désactiver la zone' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Réactiver Cotonou' })).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Réactiver Porto-Novo' }));
    await waitFor(() => expect(calls.at(-1)?.body).toEqual({ commune: 'Porto-Novo' }));
    expect(plain(screen.getByRole('table').textContent)).toContain('Porto-NovoOuverte');
  });

  it('le superviseur ne gère pas les zones', () => {
    session.set(sessionBody(['cleaning_supervisor']));
    stubGateway({ [`GET ${ADMIN}/zones`]: { status: 403, body: errorBody('AUTH_FORBIDDEN', 'Refusé.') } });
    render(<ZonesScreen />);
    expect(
      screen.getByText('Les zones desservies sont réservées à l’admin du Nettoyage.'),
    ).toBeInTheDocument();
  });
});
