import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { session } from '@/lib/api';
import { sessionBody } from '@/lib/api/session.test-utils';
import { agent, agentIds, applicant } from '@/features/cleaning/agents-fixtures.test-utils';
import { ADMIN, errorBody, ok, page, skill, stubGateway } from '@/features/cleaning/fake-gateway.test-utils';
import { AgentInvite } from './agent-invite';
import { AgentsList } from './agents-list';

let search = '';
const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: replace }),
  usePathname: () => '/nettoyage/equipe',
  useSearchParams: () => new URLSearchParams(search),
}));

beforeEach(() => {
  search = '';
  replace.mockReset();
  session.set(sessionBody(['cleaning_admin']));
});
afterEach(() => vi.unstubAllGlobals());

const references = {
  [`GET ${ADMIN}/communes`]: ok({
    data: [
      { communeKey: 'cotonou', name: 'Cotonou', zoneId: null, zoneActive: true },
      { communeKey: 'abomey-calavi', name: 'Abomey-Calavi', zoneId: null, zoneActive: true },
    ],
  }),
  [`GET ${ADMIN}/skills`]: page([skill(), skill({ code: 'vitres_hauteur', name: 'Vitres en hauteur' })]),
};

/** `GET /agents` : compteurs (`limit=1`) d'un côté, liste de l'autre. */
function agents(list: { status: number; body: unknown }, counts: Record<string, number> = {}) {
  return (_body: unknown, url: URL) =>
    url.searchParams.get('limit') === '1'
      ? page([], null, counts[url.searchParams.get('status') ?? ''] ?? 0)
      : list;
}

describe('agents et candidatures', () => {
  it('liste : statuts, communes, compétences ; candidatures à traiter mises en avant', async () => {
    const { calls } = stubGateway({
      ...references,
      [`GET ${ADMIN}/agents`]: agents(page([agent(), applicant()], 'c2', 14), {
        applicant: 3,
        under_review: 1,
      }),
    });
    render(<AgentsList />);
    const table = await screen.findByRole('table', { name: 'Agents du Nettoyage' });
    expect(within(table).getByRole('link', { name: 'Koffi AGBO TEST' })).toHaveAttribute(
      'href',
      `/nettoyage/equipe/agents/${agentIds.agent}`,
    );
    expect(within(table).getByText('+229 01 97 00 00 45')).toBeInTheDocument();
    expect(within(table).getByText('Candidature déposée')).toBeInTheDocument();
    expect(await within(table).findAllByText('Cotonou, Abomey-Calavi')).toHaveLength(2);
    expect(within(table).getByText('Vitres en hauteur (à valider)')).toBeInTheDocument();
    expect(within(table).getByText('4,6 / 5')).toBeInTheDocument();
    expect(screen.getByText('14 agents')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /Candidature déposée\s*3/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /En vérification\s*1/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Inviter ou créer un agent' })).toHaveAttribute(
      'href',
      '/nettoyage/equipe/agents/nouveau',
    );
    const list = calls.find((call) => call.path.endsWith('/agents') && call.search.includes('limit=20'));
    expect(new URLSearchParams(list?.search).get('status')).toBeNull();
  });

  it('filtres de l’adresse envoyés ; compteur, commune et recherche mettent l’adresse à jour', async () => {
    search = 'statut=applicant&competence=vitres_hauteur&tri=-ratingAverage';
    const { calls } = stubGateway({
      ...references,
      [`GET ${ADMIN}/agents`]: agents(page([applicant()]), { applicant: 1 }),
    });
    render(<AgentsList />);
    await screen.findByRole('table');
    const query = new URLSearchParams(calls.find((call) => call.search.includes('limit=20'))?.search);
    expect(query.get('status')).toBe('applicant');
    expect(query.get('skillCode')).toBe('vitres_hauteur');
    expect(query.get('sort')).toBe('-ratingAverage');

    const selected = await screen.findByRole('button', { name: /Candidature déposée\s*1/ });
    expect(selected).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: /En vérification/ }));
    expect(replace).toHaveBeenLastCalledWith(
      '/nettoyage/equipe?statut=under_review&competence=vitres_hauteur&tri=-ratingAverage',
    );
    await screen.findByRole('option', { name: 'Abomey-Calavi' });
    fireEvent.change(screen.getByLabelText('Commune de travail'), { target: { value: 'abomey-calavi' } });
    expect(replace).toHaveBeenLastCalledWith(
      '/nettoyage/equipe?statut=applicant&competence=vitres_hauteur&tri=-ratingAverage&commune=abomey-calavi',
    );
    fireEvent.change(screen.getByLabelText('Nom ou téléphone'), { target: { value: ' Ama ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rechercher' }));
    expect(replace).toHaveBeenLastCalledWith(
      '/nettoyage/equipe?statut=applicant&competence=vitres_hauteur&tri=-ratingAverage&recherche=Ama',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Effacer les filtres' }));
    expect(replace).toHaveBeenLastCalledWith('/nettoyage/equipe');
  });

  it('liste vide et erreur de lecture avec « Réessayer »', async () => {
    let lists = 0;
    stubGateway({
      ...references,
      [`GET ${ADMIN}/agents`]: (_body: unknown, url: URL) => {
        if (url.searchParams.get('limit') === '1') return page([]);
        lists += 1;
        return lists === 1
          ? { status: 503, body: errorBody('SERVICE_UNAVAILABLE', 'Service indisponible.') }
          : page([]);
      },
    });
    render(<AgentsList />);
    fireEvent.click(await screen.findByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByText(/Aucun agent pour l’instant/)).toBeInTheDocument();
  });

  it('superviseur : lecture sans invitation ; support : aucun appel', async () => {
    session.set(sessionBody(['cleaning_supervisor']));
    stubGateway({ ...references, [`GET ${ADMIN}/agents`]: agents(page([agent()])) });
    const { unmount } = render(<AgentsList />);
    await screen.findByRole('table');
    expect(screen.queryByRole('link', { name: 'Inviter ou créer un agent' })).toBeNull();
    unmount();

    session.set(sessionBody(['support_agent']));
    const { calls } = stubGateway({});
    render(<AgentsList />);
    expect(await screen.findByText('Votre rôle ne donne pas accès à cet écran.')).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });
});

describe('invitation par SMS', () => {
  it('numéro contrôlé, normalisé en +229 01, même clé au nouvel essai après une coupure', async () => {
    const { calls } = stubGateway({
      [`POST ${ADMIN}/agents/invitations`]: [
        { status: 503, body: errorBody('SERVICE_UNAVAILABLE', 'Service indisponible.') },
        ok({ id: agentIds.invitation, phone: '+2290197000045', expiresAt: '2026-11-27T10:00:00Z' }),
      ],
    });
    render(<AgentInvite />);
    const field = await screen.findByLabelText('Téléphone de l’agent');
    fireEvent.change(field, { target: { value: '12 34' } });
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer l’invitation' }));
    expect(await screen.findByText(/Numéro invalide/)).toBeInTheDocument();
    expect(calls).toHaveLength(0);

    fireEvent.change(field, { target: { value: '97 00 00 45' } });
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer l’invitation' }));
    expect(await screen.findByText(/Service indisponible/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer l’invitation' }));
    expect(await screen.findByText(/Invitation envoyée au \+229 01 97 00 00 45/)).toBeInTheDocument();
    expect(calls.map((call) => call.body)).toEqual([
      { phone: '+2290197000045' },
      { phone: '+2290197000045' },
    ]);
    expect(calls[0]?.headers['Idempotency-Key']).toBeTruthy();
    expect(calls[1]?.headers['Idempotency-Key']).toBe(calls[0]?.headers['Idempotency-Key']);
    expect(screen.getByText(/ne sait pas encore les déposer/)).toBeInTheDocument();
  });

  it('numéro déjà inscrit : message du serveur ; superviseur : invitation réservée', async () => {
    stubGateway({
      [`POST ${ADMIN}/agents/invitations`]: {
        status: 409,
        body: errorBody('CLEANING_AGENT_ALREADY_REGISTERED', 'Ce numéro est déjà inscrit comme agent.'),
      },
    });
    const { unmount } = render(<AgentInvite />);
    fireEvent.change(await screen.findByLabelText('Téléphone de l’agent'), {
      target: { value: '0197000045' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer l’invitation' }));
    expect(await screen.findByText('Ce numéro est déjà inscrit comme agent.')).toBeInTheDocument();
    unmount();

    session.set(sessionBody(['cleaning_supervisor']));
    render(<AgentInvite />);
    await waitFor(() => expect(screen.getByText(/réservées à l’administration/)).toBeInTheDocument());
    expect(screen.queryByLabelText('Téléphone de l’agent')).toBeNull();
  });
});
