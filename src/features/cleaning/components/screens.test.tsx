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
import { TeamScreen } from './team-screen';
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
const ZONES = {
  [`GET ${ADMIN}/zones`]: {
    status: 200,
    body: { data: [zone(), zone({ code: 'porto-novo', commune: 'Porto-Novo', active: false })] },
  },
};
/** Aujourd'hui à midi, heure du Bénin : un passage du jour peut être démarré. */
/** Jour lointain : le passage ne peut pas encore être démarré, quelle que soit la date du test. */
const FUTURE = '2096-11-05T08:00:00Z';
const today = () => new Date(`${new Date().toISOString().slice(0, 10)}T11:00:00Z`).toISOString();

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
      ...ZONES,
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

  it('passe la commune (code de zone) et le type de client à la gateway', async () => {
    search = 'commune=porto-novo&client=business';
    const { calls } = stubGateway({
      [PUBLIC_SERVICES]: SERVICES,
      ...ZONES,
      [`GET ${ADMIN}/quote-requests`]: {
        status: 200,
        body: {
          data: [
            quoteRequest({
              customerKind: 'business',
              organizationId: ids.team,
              customerName: 'Awa Bio',
              organizationName: 'SARL Bénin Propre',
              commune: 'Porto-Novo',
            }),
          ],
          nextCursor: null,
        },
      },
    });
    render(<RequestsList />);
    expect(await screen.findByText('SARL Bénin Propre')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(2); // en-tête + une demande, sans filtrage local
    expect(calls.find((call) => call.path.endsWith('/quote-requests'))?.search).toBe(
      '?limit=20&commune=porto-novo&customerKind=business',
    );
    // L'admin voit aussi les zones désactivées ; la valeur affichée est le nom, la valeur envoyée le code.
    const commune = screen.getByLabelText('Commune');
    await waitFor(() => expect(commune).toHaveDisplayValue('Porto-Novo'));
    fireEvent.change(commune, { target: { value: 'cotonou' } });
    expect(replace).toHaveBeenCalledWith('/nettoyage?commune=cotonou&client=business', { scroll: false });
  });

  it('le superviseur lit les zones ouvertes sur la route publique', async () => {
    session.set(sessionBody(['cleaning_supervisor']));
    const { calls } = stubGateway({
      [PUBLIC_SERVICES]: SERVICES,
      'GET /api/v1/cleaning/zones': {
        status: 200,
        body: { data: [{ code: 'cotonou', commune: 'Cotonou' }] },
      },
      [`GET ${ADMIN}/quote-requests`]: { status: 200, body: { data: [quoteRequest()], nextCursor: null } },
    });
    render(<RequestsList />);
    expect(await screen.findByRole('option', { name: 'Cotonou' })).toHaveValue('cotonou');
    expect(screen.getByText('Client sans nom')).toBeInTheDocument();
    expect(calls.some((call) => call.path === `${ADMIN}/zones`)).toBe(false);
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

  it('affiche les noms du client, de l’organisation et de l’agent de la visite', async () => {
    stubGateway({
      [PUBLIC_SERVICES]: SERVICES,
      [`GET ${REQUEST}`]: {
        status: 200,
        body: quoteRequest({
          status: 'visit_scheduled',
          customerKind: 'business',
          organizationId: ids.team,
          customerName: 'Awa Bio',
          organizationName: 'SARL Bénin Propre',
          visit: visit({ agentName: 'Koffi A.' }),
        }),
      },
      ...AGENTS,
    });
    render(<RequestDetail id={ids.request} />);
    expect(await screen.findByText('Awa Bio')).toBeInTheDocument();
    expect(screen.getByText('SARL Bénin Propre')).toBeInTheDocument();
    expect(screen.getAllByText(/Koffi A\./).length).toBeGreaterThan(0);
    expect(screen.queryByText(ids.customer)).not.toBeInTheDocument();
  });

  it('annonce l’heure à partir de laquelle le compte rendu est possible', async () => {
    stubGateway({
      [PUBLIC_SERVICES]: SERVICES,
      [`GET ${REQUEST}`]: { status: 200, body: quoteRequest({ status: 'visit_scheduled', visit: visit() }) },
      [`POST ${ADMIN}/visits/${ids.visit}/complete`]: {
        status: 422,
        body: errorBody('CLEANING_VISIT_TOO_EARLY', 'Trop tôt.', { scheduledAt: '2026-10-30T09:00:00Z' }),
      },
      ...AGENTS,
    });
    render(<RequestDetail id={ids.request} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Saisir le compte rendu' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Constats de la visite/), { target: { value: 'ok' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer le compte rendu' }));
    expect(await within(dialog).findByText(/La visite est prévue le 30 oct\. 2026/)).toBeInTheDocument();
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
  it('enregistre le paiement manuel d’un particulier avec la même clé à chaque renvoi', async () => {
    const paid = mission({
      customerKind: 'individual',
      payment: {
        ...mission().payment,
        status: 'paid',
        paid: { amount: 10000, currency: 'XOF' },
        payments: [
          {
            id: 'p1',
            amount: { amount: 10000, currency: 'XOF' },
            method: 'cash',
            reference: null,
            recordedBy: ids.agent,
            recordedByName: 'Awa Superviseure',
            recordedAt: '2026-10-28T12:00:00Z',
          },
        ],
      },
    });
    const { calls } = stubGateway({
      [PUBLIC_SERVICES]: SERVICES,
      [`GET ${MISSION}`]: { status: 200, body: mission({ customerKind: 'individual' }) },
      [`POST ${MISSION}/payments`]: [
        { status: 503, body: errorBody('GATEWAY_UNAVAILABLE', 'Service indisponible.') },
        {
          status: 400,
          body: errorBody('CLEANING_PAYMENT_INVALID', 'Trop.', {
            reason: 'exceeds_balance',
            remainingDue: { amount: 10000, currency: 'XOF' },
          }),
        },
        { status: 200, body: paid },
      ],
    });
    render(<MissionDetail id={ids.mission} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Enregistrer un paiement' }));
    const dialog = screen.getByRole('dialog');
    const send = () =>
      fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer le paiement' }));
    fireEvent.change(within(dialog).getByLabelText('Montant reçu (FCFA)'), { target: { value: '12000' } });
    send();
    expect(await within(dialog).findByText(/Service indisponible/)).toBeInTheDocument();
    send();
    expect(await within(dialog).findByText(/Reste dû : 10\s000/)).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText('Montant reçu (FCFA)'), { target: { value: '10000' } });
    send();
    await waitFor(() => expect(screen.getAllByText('Réglé').length).toBeGreaterThan(0));

    const payments = calls.filter((call) => call.path.endsWith('/payments'));
    expect(payments.at(-1)?.body).toEqual({ amount: 10000, method: 'cash' });
    const keys = payments.map((call) => call.headers['Idempotency-Key']);
    expect(keys).toHaveLength(3);
    expect(keys[0]).toMatch(/^[A-Za-z0-9_-]{8,100}$/);
    expect(new Set(keys).size).toBe(1);
    expect(screen.getByText(/enregistré par Awa Superviseure/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enregistrer un paiement' })).not.toBeInTheDocument();
  });

  it('tire une nouvelle clé à chaque ouverture du formulaire', async () => {
    const { calls } = stubGateway({
      [PUBLIC_SERVICES]: SERVICES,
      [`GET ${MISSION}`]: { status: 200, body: mission() },
      [`POST ${MISSION}/payments`]: { status: 200, body: mission() },
    });
    render(<MissionDetail id={ids.mission} />);
    for (const amount of ['1000', '2000']) {
      fireEvent.click(await screen.findByRole('button', { name: 'Enregistrer un paiement' }));
      const dialog = screen.getByRole('dialog');
      fireEvent.change(within(dialog).getByLabelText('Montant reçu (FCFA)'), { target: { value: amount } });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer le paiement' }));
      await waitFor(() =>
        expect(calls.filter((call) => call.path.endsWith('/payments')).length).toBe(Number(amount) / 1000),
      );
    }
    const keys = calls
      .filter((call) => call.path.endsWith('/payments'))
      .map((call) => call.headers['Idempotency-Key']);
    expect(new Set(keys).size).toBe(2);
  });

  it('garde le paiement manuel d’une mission terminée, sans planification ni annulation', async () => {
    stubGateway({
      [PUBLIC_SERVICES]: SERVICES,
      [`GET ${MISSION}`]: { status: 200, body: mission({ status: 'completed' }) },
    });
    render(<MissionDetail id={ids.mission} />);
    expect(await screen.findByRole('button', { name: 'Enregistrer un paiement' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Annuler la mission' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Planifier un passage' })).not.toBeInTheDocument();
  });

  it('ne propose pas de paiement manuel pour une entreprise, sans relire la demande', async () => {
    const { calls } = stubGateway({
      [PUBLIC_SERVICES]: SERVICES,
      [`GET ${MISSION}`]: {
        status: 200,
        body: mission({
          customerKind: 'business',
          organizationId: ids.team,
          customerName: 'Awa Bio',
          organizationName: 'SARL Bénin Propre',
        }),
      },
    });
    render(<MissionDetail id={ids.mission} />);
    expect(await screen.findByText(/se règle par sa facture mensuelle/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enregistrer un paiement' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Annuler la mission' })).toBeInTheDocument();
    expect(screen.getByText('SARL Bénin Propre')).toBeInTheDocument();
    expect(screen.getByText('Entreprise')).toBeInTheDocument();
    expect(calls.some((call) => call.path.includes('/quote-requests/'))).toBe(false);
  });

  it('affiche toutes les causes actives d’une suspension', async () => {
    stubGateway({
      [PUBLIC_SERVICES]: SERVICES,
      [`GET ${MISSION}`]: {
        status: 200,
        body: mission({
          status: 'on_hold',
          customerKind: 'business',
          suspension: {
            cause: 'organization_suspended',
            causes: ['organization_suspended', 'unpaid_invoices'],
            since: '2026-10-28T10:00:00Z',
            unpaidCount: 2,
          },
        }),
      },
    });
    render(<MissionDetail id={ids.mission} />);
    expect(await screen.findByText(/Mission suspendue depuis le/)).toBeInTheDocument();
    expect(screen.getByText('Compte entreprise suspendu par KSP')).toBeInTheDocument();
    expect(screen.getByText('2 factures impayées')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Planifier un passage' })).not.toBeInTheDocument();
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
      [`GET ${MISSION}`]: {
        status: 200,
        body: mission({ interventions: [intervention({ scheduledStart: today() })] }),
      },
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

  it('désactive « Démarrer » avant le jour prévu (affichage) et explique le refus de la gateway', async () => {
    stubGateway({
      [`GET ${MISSION}`]: [
        { status: 200, body: mission({ interventions: [intervention({ scheduledStart: FUTURE })] }) },
        { status: 200, body: mission({ interventions: [intervention({ scheduledStart: today() })] }) },
      ],
      [START]: {
        status: 422,
        body: errorBody('CLEANING_INTERVENTION_TOO_EARLY', 'Trop tôt.', { scheduledDate: '2026-11-05' }),
      },
    });
    const { unmount } = render(
      <InterventionScreen missionId={ids.mission} interventionId={ids.intervention} />,
    );
    const early = await screen.findByRole('button', { name: 'Démarrer le passage' });
    expect(early).toBeDisabled();
    expect(early).toHaveAccessibleDescription(/Démarrage possible à partir du lun. 5 nov. 2096/);
    unmount();

    // Le jour même, le bouton est actif ; si la gateway refuse quand même, son motif s'affiche.
    render(<InterventionScreen missionId={ids.mission} interventionId={ids.intervention} />);
    const start = await screen.findByRole('button', { name: 'Démarrer le passage' });
    expect(start).toBeEnabled();
    fireEvent.click(start);
    expect(await screen.findByText(/pourra être démarré à partir de ce jour/)).toBeInTheDocument();
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

  it('affiche le nom de l’auteur de la dernière modification', async () => {
    stubGateway({
      [`GET ${ADMIN}/zones`]: {
        status: 200,
        body: {
          data: [
            zone({ updatedBy: ids.agent, updatedByName: 'Awa Admin', updatedAt: '2026-10-28T10:00:00Z' }),
            zone({
              code: 'porto-novo',
              commune: 'Porto-Novo',
              updatedBy: ids.agent,
              updatedByName: null,
              updatedAt: '2026-10-28T10:00:00Z',
            }),
          ],
        },
      },
    });
    render(<ZonesScreen />);
    expect(await screen.findByText(/par Awa Admin/)).toBeInTheDocument();
    expect(screen.getByText(/par un membre de l’équipe/)).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(ids.agent))).not.toBeInTheDocument();
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

describe('rattacher un agent par son numéro', () => {
  const LOOKUP = 'POST /api/v1/admin/identity/accounts/lookup';
  const match = {
    userId: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d0099',
    status: 'active',
    firstName: 'Koffi',
    lastName: 'Agbo',
    phoneMasked: '+229******20',
  };
  const team = { [`GET ${ADMIN}/teams`]: { status: 200, body: { data: [] } } };

  async function openDialog() {
    fireEvent.click(await screen.findByRole('button', { name: 'Rattacher un compte' }));
    return screen.getByRole('dialog', { name: 'Rattacher un compte KSP comme agent' });
  }

  it('cherche le compte, le montre (numéro masqué) puis le rattache', async () => {
    session.set(sessionBody(['super_admin']));
    const { calls } = stubGateway({
      ...AGENTS,
      ...team,
      [LOOKUP]: { status: 200, body: match },
      [`POST ${ADMIN}/agents`]: {
        status: 200,
        body: agent({ agentId: match.userId, displayName: 'Koffi Agbo' }),
      },
    });
    render(<TeamScreen />);
    const dialog = await openDialog();
    fireEvent.change(within(dialog).getByLabelText(/Numéro de téléphone/), {
      target: { value: '97 00 00 20' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Rechercher le compte' }));
    expect(await within(dialog).findByText('+229******20')).toBeInTheDocument();
    expect(within(dialog).getByText('Koffi Agbo')).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Nom affiché/)).toHaveValue('Koffi Agbo');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Rattacher' }));
    await waitFor(() =>
      expect(calls.some((call) => call.path === `${ADMIN}/agents` && call.method === 'POST')).toBe(true),
    );
    expect(calls.find((call) => call.path.endsWith('/lookup'))?.body).toEqual({ phone: '+22997000020' });
    expect(calls.find((call) => call.path.endsWith('/lookup'))?.search).toBe('');
    expect(calls.find((call) => call.method === 'POST' && call.path === `${ADMIN}/agents`)?.body).toEqual({
      agentId: match.userId,
      displayName: 'Koffi Agbo',
    });
  });

  it('annonce un compte introuvable et la limite de recherches', async () => {
    stubGateway({
      ...AGENTS,
      ...team,
      [LOOKUP]: [
        { status: 404, body: errorBody('IDENTITY_USER_NOT_FOUND', 'Compte introuvable.') },
        {
          status: 429,
          body: errorBody('GATEWAY_RATE_LIMITED', 'Trop de requêtes.', { retryAfterSeconds: 42 }),
        },
      ],
    });
    render(<TeamScreen />);
    const dialog = await openDialog();
    const phone = within(dialog).getByLabelText(/Numéro de téléphone/);
    fireEvent.change(phone, { target: { value: '+229 01 97 00 00 99' } });
    fireEvent.keyDown(phone, { key: 'Enter' });
    expect(await within(dialog).findByText(/Aucun compte KSP pour ce numéro/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Rechercher le compte' }));
    expect(await within(dialog).findByText(/Réessayez dans 42 secondes/)).toBeInTheDocument();
    // Sans compte trouvé, le rattachement est refusé avant tout appel.
    fireEvent.click(within(dialog).getByRole('button', { name: 'Rattacher' }));
    expect(
      await within(dialog).findByText('Recherchez d’abord le compte par son numéro.'),
    ).toBeInTheDocument();
  });
});
