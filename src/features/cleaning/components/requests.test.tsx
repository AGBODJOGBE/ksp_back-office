import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { session } from '@/lib/api';
import { sessionBody } from '@/lib/api/session.test-utils';
import {
  ADMIN,
  cleaningType,
  errorBody,
  ok,
  page,
  place,
  stubGateway,
} from '@/features/cleaning/fake-gateway.test-utils';
import { requestIds, requestSummary } from '@/features/cleaning/requests-fixtures.test-utils';
import { RequestsQueue } from './requests-queue';

/** Écrans lourds sous jsdom : 15 s par test (comme les fiches agent), la suite complète charge la machine. */
vi.setConfig({ testTimeout: 15_000 });

let search = '';
const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: replace }),
  usePathname: () => '/nettoyage',
  useSearchParams: () => new URLSearchParams(search),
}));

beforeEach(() => {
  search = '';
  replace.mockReset();
  session.set(sessionBody(['cleaning_supervisor']));
});
afterEach(() => vi.unstubAllGlobals());

/** Listes de choix des filtres. */
const choices = {
  [`GET ${ADMIN}/communes`]: ok({
    data: [{ communeKey: 'cotonou', name: 'Cotonou', zoneId: null, zoneActive: true }],
  }),
  [`GET ${ADMIN}/place-types`]: page([place()]),
  [`GET ${ADMIN}/cleaning-types`]: page([cleaningType()]),
};

/** `GET /requests` : compteurs (`limit=1`) d'un côté, file de l'autre. */
function requests(list: { status: number; body: unknown }, counts: Record<string, number> = {}) {
  return (_body: unknown, url: URL) =>
    url.searchParams.get('limit') === '1'
      ? page([], null, counts[url.searchParams.get('status') ?? ''] ?? 0)
      : list;
}

describe('file des dossiers', () => {
  it('liste, compteurs « À traiter » et lien vers la fiche', async () => {
    const organization = requestSummary({
      id: requestIds.other,
      number: 'DN-000125',
      status: 'quote_sent',
      customerKind: 'organization',
      organizationId: requestIds.organization,
      organizationName: 'Hôtel TEST',
      nextVisitAt: '2026-11-28T09:00:00Z',
    });
    const { calls } = stubGateway({
      ...choices,
      [`GET ${ADMIN}/requests`]: requests(page([requestSummary(), organization], 'c2', 12), {
        visit_to_schedule: 4,
        visit_done: 2,
      }),
    });
    render(<RequestsQueue />);
    const table = await screen.findByRole('table', { name: 'Dossiers du Nettoyage' });
    const link = within(table).getByRole('link', { name: 'DN-000124' });
    expect(link).toHaveAttribute('href', `/nettoyage/dossiers/${requestIds.request}`);
    expect(within(table).getByText('Planifier la visite')).toBeInTheDocument();
    expect(within(table).getByText('Hôtel TEST')).toBeInTheDocument();
    expect(within(table).getByText('En attente du client')).toBeInTheDocument();
    expect(screen.getByText('12 dossiers')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /Visite à planifier\s*4/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Visite faite\s*2/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Afficher plus' })).toBeInTheDocument();
    const list = calls.find((call) => call.path.endsWith('/requests') && call.search.includes('limit=20'));
    expect(new URLSearchParams(list?.search).get('status')).toBeNull();
  });

  it('filtres de l’adresse envoyés ; un compteur filtre la file', async () => {
    search = 'statut=visit_done&du=2026-11-01&tri=createdAt';
    const { calls } = stubGateway({
      ...choices,
      [`GET ${ADMIN}/requests`]: requests(page([requestSummary({ status: 'visit_done' })]), {
        visit_done: 1,
      }),
    });
    render(<RequestsQueue />);
    await screen.findByRole('table');
    const list = calls.find((call) => call.search.includes('limit=20'));
    const query = new URLSearchParams(list?.search);
    expect(query.get('status')).toBe('visit_done');
    expect(query.get('from')).toBe('2026-10-31T23:00:00.000Z');
    expect(query.get('sort')).toBe('createdAt');

    const selected = await screen.findByRole('button', { name: /Visite faite\s*1/ });
    expect(selected).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: /Visite à planifier/ }));
    expect(replace).toHaveBeenLastCalledWith(
      '/nettoyage?statut=visit_to_schedule&du=2026-11-01&tri=createdAt',
    );
    fireEvent.change(screen.getByLabelText('Clientèle'), { target: { value: 'organization' } });
    expect(replace).toHaveBeenLastCalledWith(
      '/nettoyage?statut=visit_done&du=2026-11-01&tri=createdAt&clientele=organization',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Effacer les filtres' }));
    expect(replace).toHaveBeenLastCalledWith('/nettoyage');
  });

  it('recherche par numéro : 50 caractères au plus', async () => {
    stubGateway({ ...choices, [`GET ${ADMIN}/requests`]: requests(page([])) });
    render(<RequestsQueue />);
    expect(await screen.findByText('Aucun dossier pour l’instant.')).toBeInTheDocument();
    const field = screen.getByLabelText('Numéro de dossier');
    fireEvent.change(field, { target: { value: 'x'.repeat(51) } });
    fireEvent.click(screen.getByRole('button', { name: 'Rechercher' }));
    expect(await screen.findByText('50 caractères au plus.')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
    fireEvent.change(field, { target: { value: ' DN-000124 ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rechercher' }));
    expect(replace).toHaveBeenLastCalledWith('/nettoyage?numero=DN-000124');
  });

  it('vide avec filtres ; erreur de lecture avec « Réessayer »', async () => {
    search = 'statut=rejected';
    stubGateway({
      ...choices,
      [`GET ${ADMIN}/requests`]: requests(page([])),
    });
    const { unmount } = render(<RequestsQueue />);
    expect(await screen.findByText('Aucun dossier ne correspond à ces filtres.')).toBeInTheDocument();
    unmount();
    vi.unstubAllGlobals();

    search = '';
    let failures = 0;
    stubGateway({
      ...choices,
      [`GET ${ADMIN}/requests`]: (_body: unknown, url: URL) => {
        if (url.searchParams.get('limit') === '1') return page([], null, 0);
        failures += 1;
        return failures === 1
          ? { status: 503, body: errorBody('SERVICE_UNAVAILABLE', 'Service momentanément indisponible.') }
          : page([requestSummary()]);
      },
    });
    render(<RequestsQueue />);
    expect(await screen.findByText(/Service momentanément indisponible\./)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    await waitFor(() => expect(screen.getByRole('link', { name: 'DN-000124' })).toBeInTheDocument());
  });

  it('rôle sans `cleaning.request.read` : aucun appel, message neutre', async () => {
    session.set(sessionBody(['finance_agent']));
    const { calls } = stubGateway({});
    render(<RequestsQueue />);
    expect(await screen.findByText('Votre rôle ne donne pas accès à cet écran.')).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it('403 de la gateway sur la file : message propre', async () => {
    stubGateway({
      ...choices,
      [`GET ${ADMIN}/requests`]: requests({
        status: 403,
        body: errorBody('FORBIDDEN', 'Accès refusé pour cette zone.'),
      }),
    });
    render(<RequestsQueue />);
    expect(await screen.findByText(/Accès refusé pour cette zone\./)).toBeInTheDocument();
  });
});
