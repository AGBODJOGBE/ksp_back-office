import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { session } from '@/lib/api';
import { sessionBody } from '@/lib/api/session.test-utils';
import { ADMIN, errorBody, ids, ok, page, stubGateway } from '@/features/cleaning/fake-gateway.test-utils';
import { cleaningRequest, requestIds, visit } from '@/features/cleaning/requests-fixtures.test-utils';
import { VisitsCalendar } from './visits-calendar';

/** Écrans lourds sous jsdom : 15 s par test (comme les fiches agent), la suite complète charge la machine. */
vi.setConfig({ testTimeout: 15_000 });

let search = '';
const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: replace }),
  usePathname: () => '/nettoyage/visites',
  useSearchParams: () => new URLSearchParams(search),
}));

const VISITS = `${ADMIN}/visits`;
const REQUEST = `${ADMIN}/requests/${requestIds.request}`;

beforeEach(() => {
  search = 'date=2026-11-25';
  replace.mockReset();
  session.set(sessionBody(['cleaning_supervisor']));
});
afterEach(() => vi.unstubAllGlobals());

const agent = {
  id: requestIds.agent,
  userId: requestIds.customer,
  status: 'active',
  firstName: 'Koffi',
  lastName: 'TEST',
  zoneKeys: ['cotonou'],
};

/** Listes de choix des filtres et jours fériés. */
const choices = {
  [`GET ${ADMIN}/communes`]: ok({
    data: [{ communeKey: 'cotonou', name: 'Cotonou', zoneId: null, zoneActive: true }],
  }),
  [`GET ${ADMIN}/agents`]: page([agent]),
  [`GET ${ADMIN}/holidays`]: page([{ id: ids.holiday, date: '2026-11-27', name: 'Fête TEST' }]),
};

const visitsCall = (calls: { path: string; search: string }[]) =>
  new URLSearchParams(calls.filter((call) => call.path === VISITS).at(-1)?.search);

describe('calendrier des visites', () => {
  it('vue semaine : jours du lundi au dimanche, férié, visite et lien vers le dossier', async () => {
    const { calls } = stubGateway({ ...choices, [`GET ${VISITS}`]: page([visit()]) });
    render(<VisitsCalendar />);
    expect(await screen.findByText('1 visite sur la période')).toBeInTheDocument();
    const grid = screen.getByRole('group', { name: 'Calendrier des visites' });
    expect(within(grid).getAllByRole('heading', { level: 3 })).toHaveLength(7);
    expect(within(grid).getByRole('heading', { name: /lun\. 23 nov\. 2026/ })).toBeInTheDocument();
    expect(within(grid).getByRole('heading', { name: /dim\. 29 nov\. 2026/ })).toBeInTheDocument();
    expect(await within(grid).findByText('Férié : Fête TEST')).toBeInTheDocument();
    expect(within(grid).getByText('10:00 – 11:00')).toBeInTheDocument();
    expect(within(grid).getByText('Planifiée')).toBeInTheDocument();
    expect(within(grid).getByText('Koffi TEST')).toBeInTheDocument();
    expect(within(grid).getByRole('link', { name: 'Dossier DN-000124' })).toHaveAttribute(
      'href',
      `/nettoyage/dossiers/${requestIds.request}`,
    );
    const query = visitsCall(calls);
    expect(query.get('from')).toBe('2026-11-22T23:00:00.000Z');
    expect(query.get('to')).toBe('2026-11-29T23:00:00.000Z');
    expect(query.get('limit')).toBe('100');
  });

  it('vue jour : un seul jour ; navigation et changement de vue dans l’adresse', async () => {
    search = 'vue=jour&date=2026-11-28';
    const { calls } = stubGateway({ ...choices, [`GET ${VISITS}`]: page([visit()]) });
    render(<VisitsCalendar />);
    expect(await screen.findByText('1 visite sur la période')).toBeInTheDocument();
    const grid = screen.getByRole('group', { name: 'Calendrier des visites' });
    expect(within(grid).getAllByRole('heading', { level: 3 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 2, name: /samedi 28 novembre 2026/ })).toBeInTheDocument();
    expect(visitsCall(calls).get('from')).toBe('2026-11-27T23:00:00.000Z');

    fireEvent.click(screen.getByRole('button', { name: 'Jour suivant' }));
    expect(replace).toHaveBeenLastCalledWith('/nettoyage/visites?vue=jour&date=2026-11-29');
    fireEvent.click(screen.getByRole('button', { name: 'Semaine' }));
    expect(replace).toHaveBeenLastCalledWith('/nettoyage/visites?vue=semaine&date=2026-11-28');
  });

  it('filtres de l’adresse envoyés à la gateway ; un choix met l’adresse à jour', async () => {
    search = `date=2026-11-25&statut=scheduled&agent=${requestIds.agent}&commune=cotonou`;
    const { calls } = stubGateway({ ...choices, [`GET ${VISITS}`]: page([]) });
    render(<VisitsCalendar />);
    expect(await screen.findByText('Aucune visite sur cette période pour ces filtres.')).toBeInTheDocument();
    const query = visitsCall(calls);
    expect(query.get('status')).toBe('scheduled');
    expect(query.get('agentId')).toBe(requestIds.agent);
    expect(query.get('communeKey')).toBe('cotonou');

    const agentSelect = screen.getByLabelText('Agent');
    await within(agentSelect).findByRole('option', { name: 'Koffi TEST' });
    fireEvent.change(screen.getByLabelText('Statut'), { target: { value: 'missed' } });
    expect(replace).toHaveBeenLastCalledWith(
      `/nettoyage/visites?date=2026-11-25&statut=missed&agent=${requestIds.agent}&commune=cotonou`,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Effacer les filtres' }));
    expect(replace).toHaveBeenLastCalledWith('/nettoyage/visites?date=2026-11-25');
  });
});

describe('calendrier des visites : gestion, états et droits', () => {
  const scheduled = () => cleaningRequest({ status: 'visit_scheduled', visits: [visit()] });

  it('déplace une visite depuis le calendrier, puis relit le calendrier', async () => {
    const { calls } = stubGateway({
      ...choices,
      [`GET ${VISITS}`]: page([visit()]),
      [`GET ${REQUEST}`]: ok(scheduled()),
      [`PATCH ${VISITS}/${requestIds.visit}`]: ok(visit({ scheduledAt: '2026-11-28T14:00:00Z' })),
    });
    render(<VisitsCalendar />);
    fireEvent.click(await screen.findByRole('button', { name: 'Gérer la visite DN-000124 de 10:00' }));
    const panel = await screen.findByRole('region', { name: 'Visite du dossier DN-000124' });
    expect(within(panel).getByRole('heading', { level: 2 })).toHaveFocus();
    expect(await within(panel).findByText('Maison de Fidjrossè, Cotonou')).toBeInTheDocument();
    expect(within(panel).getByRole('link', { name: 'Ouvrir le dossier' })).toHaveAttribute(
      'href',
      `/nettoyage/dossiers/${requestIds.request}`,
    );

    fireEvent.click(within(panel).getByRole('button', { name: 'Déplacer ou changer d’agent' }));
    const form = within(panel).getByRole('form', { name: 'Déplacer la visite ou changer d’agent' });
    fireEvent.change(within(form).getByLabelText('Date et heure (heure du Bénin)'), {
      target: { value: '2026-11-28T15:00' },
    });
    fireEvent.click(within(form).getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(calls.filter((call) => call.path === VISITS)).toHaveLength(2));
    const patch = calls.find((call) => call.method === 'PATCH');
    expect(patch?.body).toEqual({ scheduledAt: '2026-11-28T14:00:00.000Z' });
    expect(patch?.headers['Idempotency-Key']).toBeTruthy();

    fireEvent.click(within(panel).getByRole('button', { name: 'Fermer' }));
    expect(screen.queryByRole('region', { name: 'Visite du dossier DN-000124' })).not.toBeInTheDocument();
  });

  it('période vide : message et jours affichés', async () => {
    stubGateway({ ...choices, [`GET ${VISITS}`]: page([]) });
    render(<VisitsCalendar />);
    expect(await screen.findByText('Aucune visite prévue sur cette période.')).toBeInTheDocument();
    expect(screen.getAllByText('Aucune visite.')).toHaveLength(7);
  });

  it('erreur de la gateway : message lisible et « Réessayer »', async () => {
    stubGateway({
      ...choices,
      [`GET ${VISITS}`]: [
        { status: 500, body: errorBody('INTERNAL_ERROR', 'Erreur interne.') },
        page([visit()]),
      ],
    });
    render(<VisitsCalendar />);
    fireEvent.click(await screen.findByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByText('1 visite sur la période')).toBeInTheDocument();
  });

  it('support : lecture seule, sans liste des agents ; sans droit : aucun appel', async () => {
    session.set(sessionBody(['support_agent']));
    const { calls } = stubGateway({
      ...choices,
      [`GET ${VISITS}`]: page([visit()]),
      [`GET ${REQUEST}`]: ok(scheduled()),
    });
    const { unmount } = render(<VisitsCalendar />);
    fireEvent.click(await screen.findByRole('button', { name: 'Gérer la visite DN-000124 de 10:00' }));
    const panel = await screen.findByRole('region', { name: 'Visite du dossier DN-000124' });
    expect(await within(panel).findByText('Maison de Fidjrossè, Cotonou')).toBeInTheDocument();
    expect(within(panel).queryByRole('button', { name: 'Déplacer ou changer d’agent' })).toBeNull();
    expect(within(panel).queryByRole('button', { name: 'Annuler la visite' })).toBeNull();
    expect(screen.queryByLabelText('Agent')).toBeNull();
    expect(calls.some((call) => call.path === `${ADMIN}/agents`)).toBe(false);
    unmount();

    session.set(sessionBody(['finance_agent']));
    const denied = stubGateway({});
    render(<VisitsCalendar />);
    expect(await screen.findByText('Votre rôle ne donne pas accès à cet écran.')).toBeInTheDocument();
    expect(denied.calls).toHaveLength(0);
  });
});
