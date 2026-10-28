import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { api, session } from '@/lib/api';
import {
  errorBody,
  NO_SESSION,
  sessionBody,
  stubGateway,
  USER,
} from '@/features/identity/fake-gateway.test-utils';
import { AccountPanel } from './account-panel';
import { RequireSession } from './require-session';

const replace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/finance',
}));

const REFRESH = 'POST /api/v1/identity/token/refresh';
const LOGOUT = 'POST /api/v1/identity/logout';
const ME = 'GET /api/v1/identity/me';

const ME_BODY = {
  user: { ...USER, email: 'koffi@ksp.bj', emailVerified: true },
  profileIncomplete: false,
  pendingEmail: null,
  activeContext: { type: 'individual', organizationId: null },
};

function renderSpace() {
  return render(
    <>
      <AccountPanel />
      <RequireSession>
        <p>Contenu réservé</p>
      </RequireSession>
    </>,
  );
}

beforeEach(() => {
  replace.mockReset();
  session.clear();
  window.history.replaceState(null, '', '/finance?onglet=versements');
});

afterEach(() => vi.unstubAllGlobals());

describe('garde des pages du back-office', () => {
  it('renouvelle la session en silence puis affiche la page et le compte', async () => {
    const { calls } = stubGateway({
      [REFRESH]: { status: 200, body: sessionBody() },
      [ME]: { status: 200, body: ME_BODY },
    });
    renderSpace();

    expect(screen.getByRole('status')).toHaveTextContent('Vérification de votre session…');
    expect(await screen.findByText('Contenu réservé')).toBeInTheDocument();
    expect(screen.getByText('Koffi Adjovi')).toBeInTheDocument();
    expect(await screen.findByText('koffi@ksp.bj')).toBeInTheDocument();
    expect(calls[0]).toMatchObject({
      method: 'POST',
      path: '/api/v1/identity/token/refresh',
      body: undefined,
    });
    expect(calls.find((call) => call.path === '/api/v1/identity/me')?.headers.Authorization).toMatch(
      /^Bearer /,
    );
    expect(replace).not.toHaveBeenCalled();
  });

  it('sans session, envoie vers la connexion en gardant la page demandée', async () => {
    stubGateway({ [REFRESH]: NO_SESSION });
    renderSpace();

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith('/connexion?retour=%2Ffinance%3Fonglet%3Dversements'),
    );
    expect(screen.queryByText('Contenu réservé')).toBeNull();
  });

  it('distingue une panne de la gateway et propose de réessayer', async () => {
    stubGateway({
      [REFRESH]: [
        {
          status: 503,
          body: errorBody('IDENTITY_UNAVAILABLE', 'Le service est momentanément indisponible.'),
        },
        { status: 200, body: sessionBody() },
      ],
      [ME]: { status: 200, body: ME_BODY },
    });
    renderSpace();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /Impossible de vérifier votre session\. Le service est momentanément indisponible\./,
    );
    expect(replace).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByText('Contenu réservé')).toBeInTheDocument();
  });

  it('explique un accès retiré par le backend au lieu de boucler sur la connexion', async () => {
    stubGateway({
      [REFRESH]: {
        status: 403,
        body: errorBody('IDENTITY_BACKOFFICE_FORBIDDEN', 'Ce compte n’a plus accès au back-office.'),
      },
    });
    renderSpace();

    expect(await screen.findByRole('heading', { name: 'Accès au back-office retiré' })).toBeInTheDocument();
    expect(screen.getByText('Ce compte n’a plus accès au back-office.')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it('session fermée pendant la visite (inactivité) : explication et reconnexion vers la même page', async () => {
    stubGateway({
      [REFRESH]: [{ status: 200, body: sessionBody() }, NO_SESSION],
      [ME]: { status: 200, body: ME_BODY },
      'GET /api/v1/billing/invoices': {
        status: 401,
        body: errorBody('GATEWAY_TOKEN_EXPIRED', 'Votre session a expiré, reconnectez-vous.'),
      },
    });
    renderSpace();
    await screen.findByText('Contenu réservé');

    // Une requête refusée : un seul renouvellement, refusé à son tour (30 min sans activité).
    await act(async () => {
      await api.get('/api/v1/billing/invoices').catch(() => undefined);
    });

    expect(await screen.findByRole('heading', { name: 'Votre session a pris fin' })).toBeInTheDocument();
    expect(screen.getByText(/30 minutes sans activité/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Se reconnecter' })).toHaveAttribute(
      'href',
      '/connexion?retour=%2Ffinance%3Fonglet%3Dversements',
    );
    expect(screen.queryByText('Contenu réservé')).toBeNull();
  });
});

describe('déconnexion', () => {
  it('ferme la session côté gateway, vide la mémoire et revient à la connexion', async () => {
    const { calls } = stubGateway({
      [REFRESH]: { status: 200, body: sessionBody() },
      [ME]: { status: 200, body: ME_BODY },
      [LOGOUT]: { status: 200, body: { revokedSessions: 1 } },
    });
    renderSpace();
    fireEvent.click(await screen.findByRole('button', { name: 'Se déconnecter' }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/connexion'));
    expect(session.get()).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('Déconnexion…');
    const logout = calls.find((call) => call.path === '/api/v1/identity/logout');
    expect(logout?.headers.Authorization).toMatch(/^Bearer /);
  });

  it('garde la session si la gateway ne répond pas', async () => {
    stubGateway({
      [REFRESH]: { status: 200, body: sessionBody() },
      [ME]: { status: 200, body: ME_BODY },
      [LOGOUT]: { status: 503, body: errorBody('IDENTITY_UNAVAILABLE', 'Service indisponible.') },
    });
    renderSpace();
    fireEvent.click(await screen.findByRole('button', { name: 'Se déconnecter' }));

    expect(await screen.findByText(/Service indisponible\./)).toBeInTheDocument();
    expect(session.get()).not.toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });
});

describe('compte de l’agent', () => {
  it('montre l’échec de lecture du profil et permet de réessayer', async () => {
    stubGateway({
      [REFRESH]: { status: 200, body: sessionBody() },
      [ME]: [
        { status: 503, body: errorBody('IDENTITY_UNAVAILABLE', 'Profil momentanément indisponible.') },
        { status: 200, body: ME_BODY },
      ],
    });
    renderSpace();
    expect(await screen.findByText('Profil momentanément indisponible.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByText('koffi@ksp.bj')).toBeInTheDocument();
  });
});
