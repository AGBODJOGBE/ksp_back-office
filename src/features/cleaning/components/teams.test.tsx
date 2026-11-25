import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { session } from '@/lib/api';
import { sessionBody } from '@/lib/api/session.test-utils';
import { agent, agentIds, applicant, team } from '@/features/cleaning/agents-fixtures.test-utils';
import { ADMIN, errorBody, ok, page, stubGateway } from '@/features/cleaning/fake-gateway.test-utils';
import { NewTeam, TeamDetail } from './team-detail';
import { TeamsList } from './teams-list';

/** Écrans lourds sous jsdom : 15 s par test (comme les fiches agent), la suite complète charge la machine. */
vi.setConfig({ testTimeout: 15_000 });

let search = '';
const replace = vi.fn();
const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push }),
  usePathname: () => '/nettoyage/equipe/equipes',
  useSearchParams: () => new URLSearchParams(search),
}));

const TEAM = `${ADMIN}/teams/${agentIds.team}`;
const SLOW = 15_000;

beforeEach(() => {
  search = '';
  replace.mockReset();
  push.mockReset();
  session.set(sessionBody(['cleaning_admin']));
});
afterEach(() => vi.unstubAllGlobals());

describe('équipes', () => {
  it('liste : chef d’équipe, membres, état ; filtre d’état dans l’adresse', async () => {
    search = 'etat=actives';
    const { calls } = stubGateway({ [`GET ${ADMIN}/teams`]: page([team()], null, 1) });
    render(<TeamsList />);
    const table = await screen.findByRole('table', { name: 'Équipes du Nettoyage' });
    expect(within(table).getByRole('link', { name: 'Équipe Cotonou TEST' })).toHaveAttribute(
      'href',
      `/nettoyage/equipe/equipes/${agentIds.team}`,
    );
    expect(within(table).getAllByText('Koffi AGBO TEST')).not.toHaveLength(0);
    expect(within(table).getByText('2 membres')).toBeInTheDocument();
    expect(screen.getByText('1 équipe')).toBeInTheDocument();
    expect(new URLSearchParams(calls[0]?.search).get('active')).toBe('true');
    fireEvent.change(screen.getByLabelText('État'), { target: { value: 'desactivees' } });
    expect(replace).toHaveBeenLastCalledWith('/nettoyage/equipe/equipes?etat=desactivees');
    expect(screen.getByRole('link', { name: 'Créer une équipe' })).toBeInTheDocument();
  });

  it(
    'création : membres et chef contrôlés, clé d’idempotence, ouverture de la fiche',
    async () => {
      const { calls } = stubGateway({
        [`GET ${ADMIN}/agents`]: page([agent(), applicant({ status: 'active' })]),
        [`POST ${ADMIN}/teams`]: [
          { status: 504, body: errorBody('GATEWAY_TIMEOUT', 'Délai dépassé.') },
          ok(team()),
        ],
      });
      render(<NewTeam />);
      const name = await screen.findByLabelText('Nom de l’équipe');
      fireEvent.click(screen.getByRole('button', { name: 'Créer l’équipe' }));
      expect(await screen.findByText('Choisissez au moins un membre.')).toBeInTheDocument();
      expect(screen.getByText('Choisissez le chef d’équipe parmi les membres.')).toBeInTheDocument();
      expect(calls.some((call) => call.method === 'POST')).toBe(false);

      fireEvent.change(name, { target: { value: ' Équipe Cotonou TEST ' } });
      fireEvent.click(screen.getByLabelText('Koffi AGBO TEST'));
      fireEvent.click(screen.getByLabelText('Ama DOSSOU TEST'));
      fireEvent.change(screen.getByLabelText(/Chef d’équipe/), { target: { value: agentIds.other } });
      fireEvent.click(screen.getByRole('button', { name: 'Créer l’équipe' }));
      expect(await screen.findByText(/Délai dépassé/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Créer l’équipe' }));
      await waitFor(() => expect(push).toHaveBeenCalledWith(`/nettoyage/equipe/equipes/${agentIds.team}`));
      const posts = calls.filter((call) => call.method === 'POST');
      expect(posts[0]?.body).toEqual({
        name: 'Équipe Cotonou TEST',
        leadAgentId: agentIds.other,
        memberIds: [agentIds.agent, agentIds.other],
      });
      expect(posts[1]?.headers['Idempotency-Key']).toBe(posts[0]?.headers['Idempotency-Key']);
    },
    SLOW,
  );

  it(
    'fiche : membres et chef, modification des seuls champs changés, désactivation confirmée',
    async () => {
      const { calls } = stubGateway({
        [`GET ${TEAM}`]: ok(team()),
        [`GET ${ADMIN}/agents`]: page([agent()]),
        [`PATCH ${TEAM}`]: [ok(team({ name: 'Équipe Akpakpa TEST' })), ok(team({ active: false }))],
      });
      render(<TeamDetail id={agentIds.team} />);
      expect(await screen.findByRole('heading', { name: 'Équipe Cotonou TEST' })).toBeInTheDocument();
      const members = screen.getByRole('region', { name: 'Membres' });
      expect(within(members).getByText('Chef d’équipe')).toBeInTheDocument();
      expect(within(members).getByText('Suspendu')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Modifier l’équipe' }));
      fireEvent.change(await screen.findByLabelText('Nom de l’équipe'), {
        target: { value: 'Équipe Akpakpa TEST' },
      });
      expect(screen.getByLabelText(/Ama DOSSOU TEST \(suspendu\)/)).toBeChecked();
      fireEvent.click(screen.getByRole('button', { name: 'Enregistrer l’équipe' }));
      expect(await screen.findByText('Équipe enregistrée.')).toBeInTheDocument();
      expect(calls.find((call) => call.method === 'PATCH')?.body).toEqual({ name: 'Équipe Akpakpa TEST' });

      fireEvent.click(screen.getByRole('button', { name: 'Désactiver l’équipe' }));
      const box = screen.getByRole('dialog', { name: 'Désactiver l’équipe' });
      fireEvent.click(within(box).getByRole('button', { name: 'Désactiver l’équipe' }));
      expect(await screen.findByText('Équipe désactivée.')).toBeInTheDocument();
      expect(calls.filter((call) => call.method === 'PATCH').at(-1)?.body).toEqual({ active: false });
      expect(screen.getByRole('button', { name: 'Réactiver l’équipe' })).toBeInTheDocument();
    },
    SLOW,
  );

  it('équipe introuvable ; superviseur : lecture seule, sans création', async () => {
    stubGateway({
      [`GET ${TEAM}`]: { status: 404, body: errorBody('CLEANING_TEAM_NOT_FOUND', 'Équipe introuvable.') },
    });
    const { unmount } = render(<TeamDetail id={agentIds.team} />);
    expect(await screen.findByText(/introuvable/i)).toBeInTheDocument();
    unmount();

    session.set(sessionBody(['cleaning_supervisor']));
    stubGateway({ [`GET ${TEAM}`]: ok(team()), [`GET ${ADMIN}/teams`]: page([team()]) });
    const detail = render(<TeamDetail id={agentIds.team} />);
    expect(await screen.findByText(/Lecture seule : la gestion des équipes/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Modifier l’équipe' })).toBeNull();
    detail.unmount();
    render(<TeamsList />);
    await screen.findByRole('table');
    expect(screen.queryByRole('link', { name: 'Créer une équipe' })).toBeNull();
  });
});
