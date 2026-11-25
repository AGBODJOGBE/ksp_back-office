import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { session } from '@/lib/api';
import { sessionBody, TEST_USER } from '@/lib/api/session.test-utils';
import { ADMIN, errorBody, ok, page, stubGateway } from '@/features/cleaning/fake-gateway.test-utils';
import {
  cleaningSession,
  program,
  programIds,
  sessionWithoutAmounts,
  suspendedProgram,
} from '@/features/cleaning/programs-fixtures.test-utils';
import { ProgramDetail } from './program-detail';
import { ProgramsList } from './programs-list';

/** Écrans lourds sous jsdom : 15 s par test (comme les fiches agent), la suite complète charge la machine. */
vi.setConfig({ testTimeout: 15_000 });

let search = '';
const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => '/nettoyage/programmes',
  useSearchParams: () => new URLSearchParams(search),
}));

const PROGRAMS = `${ADMIN}/programs`;
const PROGRAM = `${PROGRAMS}/${programIds.program}`;
const SLOW = 15_000;

/** Fiche simulée : le programme, son échéancier et les décisions données. */
function stubProgram(body: unknown, extra: Record<string, unknown> = {}) {
  return stubGateway({
    [`GET ${PROGRAM}`]: ok(body),
    [`GET ${PROGRAM}/sessions`]: page([cleaningSession()], null, 24),
    ...(extra as Record<string, never>),
  });
}

beforeEach(() => {
  search = '';
  replace.mockReset();
  session.set(sessionBody(['cleaning_admin']));
});
afterEach(() => vi.unstubAllGlobals());

describe('programmes : liste', () => {
  it('colonnes, signaux d’action, compteur des suspendus, filtres dans l’adresse', async () => {
    search = 'statut=suspended&payeur=individual';
    const flagged = suspendedProgram({
      pendingCancellation: {
        reason: 'Départ',
        requestedBy: programIds.other,
        requestedAt: '2026-11-21T10:00:00Z',
      },
    });
    const { calls } = stubGateway({
      [`GET ${PROGRAMS}`]: (_body, url) =>
        url.searchParams.get('limit') === '1' ? page([flagged], null, 2) : page([flagged], null, 1),
      [`GET ${ADMIN}/communes`]: ok({ data: [] }),
    });
    render(<ProgramsList />);
    const table = await screen.findByRole('table', { name: 'Programmes du Nettoyage' });
    expect(within(table).getByRole('link', { name: 'PN-000057' })).toHaveAttribute(
      'href',
      `/nettoyage/programmes/${programIds.program}`,
    );
    expect(within(table).getAllByText('Arrêt à valider')).not.toHaveLength(0);
    expect(within(table).getAllByText('Impayés')).not.toHaveLength(0);
    expect(within(table).getAllByText('Valider ou laisser l’arrêt demandé')).not.toHaveLength(0);
    expect(within(table).getAllByText('3 / 24 réalisées')).not.toHaveLength(0);
    expect(screen.getByText('1 programme')).toBeInTheDocument();
    const listCall = calls.find((call) => call.path === PROGRAMS && !call.search.includes('limit=1'));
    const query = new URLSearchParams(listCall?.search);
    expect(query.get('status')).toBe('suspended');
    expect(query.get('payerKind')).toBe('individual');
    const counter = await screen.findByRole('button', { name: /Programmes suspendus/ });
    expect(counter).toHaveAttribute('aria-pressed', 'true');
    expect(counter).toHaveTextContent('2');
    fireEvent.click(counter);
    expect(replace).toHaveBeenLastCalledWith('/nettoyage/programmes?payeur=individual');
  });

  it('liste vide, puis rôle sans `cleaning.program.read` : aucun appel', async () => {
    stubGateway({ [`GET ${PROGRAMS}`]: page([]), [`GET ${ADMIN}/communes`]: ok({ data: [] }) });
    const { unmount } = render(<ProgramsList />);
    expect(await screen.findByText('Aucun programme pour l’instant.')).toBeInTheDocument();
    unmount();
    session.set(sessionBody(['finance_agent']));
    const { calls } = stubGateway({});
    render(<ProgramsList />);
    expect(await screen.findByText('Votre rôle ne donne pas accès à cet écran.')).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });
});

describe('programmes : fiche et échéancier', () => {
  it('en-tête, résumé, lien vers le dossier, échéancier avec paiement', async () => {
    stubProgram(program());
    render(<ProgramDetail id={programIds.program} />);
    expect(await screen.findByRole('heading', { name: 'PN-000057', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Afi TEST')).toBeInTheDocument();
    expect(screen.getByText('Maison TEST — Villa, Cotonou')).toBeInTheDocument();
    expect(
      screen.getByText(/Chaque semaine \(lundi, jeudi\) à 09:00, pendant 12 semaines/),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ouvrir le dossier du programme PN-000057' })).toHaveAttribute(
      'href',
      `/nettoyage/dossiers/${programIds.request}`,
    );
    const table = await screen.findByRole('table', { name: 'Séances du programme' });
    expect(within(table).getByRole('link', { name: 'Séance 4 / 24' })).toHaveAttribute(
      'href',
      `/nettoyage/programmes/${programIds.program}/seances/${programIds.session}`,
    );
    expect(within(table).getAllByText('À payer')).not.toHaveLength(0);
    expect(within(table).getAllByText('Koffi TEST, Awa TEST')).not.toHaveLength(0);
    expect(screen.getByText('24 séances')).toBeInTheDocument();
  });

  it('montants masqués sans `cleaning.amounts.read`', async () => {
    const { sessionPrice: _price, total: _total, ...hidden } = program();
    stubGateway({
      [`GET ${PROGRAM}`]: ok(hidden),
      [`GET ${PROGRAM}/sessions`]: page([sessionWithoutAmounts()]),
    });
    render(<ProgramDetail id={programIds.program} />);
    await screen.findByRole('table', { name: 'Séances du programme' });
    expect(screen.getAllByText('Montant masqué').length).toBeGreaterThanOrEqual(3);
  });

  it('programme introuvable', async () => {
    stubGateway({
      [`GET ${PROGRAM}`]: { status: 404, body: errorBody('CLEANING_PROGRAM_NOT_FOUND', 'Introuvable.') },
    });
    render(<ProgramDetail id={programIds.program} />);
    expect(await screen.findByText(/Élément introuvable/)).toBeInTheDocument();
  });
});

describe('programmes : décisions', () => {
  it(
    'suspension confirmée avec motif ; nouvel essai avec la même clé',
    async () => {
      const { calls } = stubProgram(program(), {
        [`POST ${PROGRAM}/suspend`]: [
          { status: 504, body: errorBody('GATEWAY_TIMEOUT', 'Délai dépassé.') },
          ok(suspendedProgram()),
        ],
      });
      render(<ProgramDetail id={programIds.program} />);
      fireEvent.click(await screen.findByRole('button', { name: 'Suspendre' }));
      const dialog = screen.getByRole('dialog', { name: 'Suspendre le programme' });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Suspendre le programme' }));
      expect(await within(dialog).findByText('Champ obligatoire.')).toBeInTheDocument();
      fireEvent.change(within(dialog).getByLabelText('Motif'), { target: { value: 'Client injoignable' } });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Suspendre le programme' }));
      expect(await within(dialog).findByText(/Délai dépassé/)).toBeInTheDocument();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Suspendre le programme' }));
      expect(await screen.findByText('Programme suspendu.')).toBeInTheDocument();
      const posts = calls.filter((call) => call.method === 'POST');
      expect(posts[1]?.body).toEqual({ reason: 'Client injoignable' });
      expect(posts[1]?.headers['Idempotency-Key']).toBe(posts[0]?.headers['Idempotency-Key']);
      expect(screen.getByRole('button', { name: 'Lever la suspension de KSP' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Changer l’horaire des séances à venir' })).toBeNull();
    },
    SLOW,
  );

  it(
    'arrêt demandé puis validé par une autre personne ; l’auteur ne peut pas valider',
    async () => {
      const pending = {
        reason: 'Déménagement',
        requestedBy: TEST_USER.id,
        requestedAt: '2026-11-21T10:00:00Z',
      };
      const { calls } = stubProgram(program(), {
        [`POST ${PROGRAM}/cancel`]: ok(program({ pendingCancellation: pending })),
      });
      const { unmount } = render(<ProgramDetail id={programIds.program} />);
      fireEvent.click(await screen.findByRole('button', { name: 'Demander l’arrêt' }));
      const dialog = screen.getByRole('dialog', { name: 'Demander l’arrêt du programme' });
      fireEvent.change(within(dialog).getByLabelText('Motif'), { target: { value: 'Déménagement' } });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Demander l’arrêt' }));
      expect(await screen.findByText('Arrêt demandé : en attente de validation.')).toBeInTheDocument();
      expect(calls.find((call) => call.method === 'POST')?.body).toEqual({ reason: 'Déménagement' });
      expect(screen.getByText(/Vous avez demandé cet arrêt/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Valider l’arrêt' })).toBeNull();
      unmount();

      const other = { ...pending, requestedBy: programIds.other };
      const second = stubProgram(program({ pendingCancellation: other }), {
        [`POST ${PROGRAM}/cancel/approve`]: [
          {
            status: 403,
            body: errorBody('CLEANING_SECOND_APPROVER_REQUIRED', 'Une deuxième personne doit valider.'),
          },
          ok(program({ status: 'cancelled' })),
        ],
      });
      render(<ProgramDetail id={programIds.program} />);
      fireEvent.click(await screen.findByRole('button', { name: 'Valider l’arrêt' }));
      const approve = screen.getByRole('dialog', { name: 'Valider l’arrêt du programme' });
      expect(approve).toHaveTextContent('Motif : Déménagement');
      fireEvent.click(within(approve).getByRole('button', { name: 'Valider l’arrêt' }));
      expect(await within(approve).findByText('Une deuxième personne doit valider.')).toBeInTheDocument();
      fireEvent.click(within(approve).getByRole('button', { name: 'Valider l’arrêt' }));
      expect(await screen.findByText('Programme arrêté.')).toBeInTheDocument();
      expect(screen.getByText(/plus aucune décision possible/)).toBeInTheDocument();
      expect(second.calls.filter((call) => call.method === 'POST')[1]?.body).toBeUndefined();
    },
    SLOW,
  );

  it(
    'changement d’horaire : plan prérempli, erreur métier, envoi',
    async () => {
      const { calls } = stubProgram(program(), {
        [`POST ${PROGRAM}/schedule-change`]: [
          {
            status: 422,
            body: errorBody(
              'CLEANING_AMENDMENT_REQUIRED',
              'Le nombre de séances change : préparez un avenant.',
            ),
          },
          ok(program()),
        ],
      });
      render(<ProgramDetail id={programIds.program} />);
      fireEvent.click(await screen.findByRole('button', { name: 'Changer l’horaire des séances à venir' }));
      const form = await screen.findByRole('region', {
        name: 'Changer le jour ou l’heure des séances à venir',
      });
      expect(within(form).getByLabelText('Lundi')).toBeChecked();
      fireEvent.change(within(form).getByLabelText('Séances concernées à partir du'), {
        target: { value: '2026-12-01' },
      });
      fireEvent.change(within(form).getByLabelText('Heure de début (heure du Bénin)'), {
        target: { value: '14:00' },
      });
      fireEvent.click(within(form).getByRole('button', { name: 'Changer l’horaire' }));
      expect(await within(form).findByText('Champ obligatoire.')).toBeInTheDocument();
      fireEvent.change(within(form).getByLabelText('Motif'), { target: { value: 'Demande du client' } });
      fireEvent.click(within(form).getByRole('button', { name: 'Changer l’horaire' }));
      expect(await within(form).findByText(/préparez un avenant/)).toBeInTheDocument();
      fireEvent.click(within(form).getByRole('button', { name: 'Changer l’horaire' }));
      expect(await screen.findByText(/Horaire changé/)).toBeInTheDocument();
      expect(calls.filter((call) => call.method === 'POST').at(-1)?.body).toEqual({
        effectiveFrom: '2026-12-01',
        reason: 'Demande du client',
        schedule: {
          kind: 'weekly',
          startTime: '14:00',
          excludeHolidays: true,
          weekdays: ['mon', 'thu'],
          everyWeeks: 1,
          startDate: '2026-11-02',
          durationWeeks: 12,
        },
      });
    },
    SLOW,
  );

  it('support : lecture seule, aucune décision', async () => {
    session.set(sessionBody(['support_agent']));
    stubProgram(program());
    render(<ProgramDetail id={programIds.program} />);
    expect(await screen.findByText(/Lecture seule : les décisions/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Suspendre' })).toBeNull();
    await waitFor(() =>
      expect(screen.getByRole('table', { name: 'Séances du programme' })).toBeInTheDocument(),
    );
  });
});
