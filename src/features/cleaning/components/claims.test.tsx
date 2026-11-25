import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { session } from '@/lib/api';
import { sessionBody, TEST_USER } from '@/lib/api/session.test-utils';
import { claim, claimIds, creditDecision } from '@/features/cleaning/claims-fixtures.test-utils';
import { ADMIN, errorBody, ok, page, stubGateway } from '@/features/cleaning/fake-gateway.test-utils';
import { ClaimDetail } from './claim-detail';
import { ClaimsQueue } from './claims-queue';

/** Écrans lourds sous jsdom : 15 s par test (comme les fiches agent), la suite complète charge la machine. */
vi.setConfig({ testTimeout: 15_000 });

let search = '';
const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => '/nettoyage/reclamations',
  useSearchParams: () => new URLSearchParams(search),
}));

const CLAIMS = `${ADMIN}/claims`;
const CLAIM = `${CLAIMS}/${claimIds.claim}`;
/** Écrans lourds sous jsdom : même délai que les fiches agent et programme. */
const SLOW = 15_000;

beforeEach(() => {
  search = '';
  replace.mockReset();
  session.set(sessionBody(['support_agent']));
});
afterEach(() => vi.unstubAllGlobals());

describe('réclamations : file', () => {
  it('ce qui attend une action, compteurs, filtres dans l’adresse', async () => {
    search = 'statut=open&tri=-openedAt';
    const { calls } = stubGateway({
      [`GET ${CLAIMS}`]: (_body, url) =>
        url.searchParams.get('limit') === '1' ? page([claim()], null, 3) : page([claim()], null, 1),
      [`GET ${ADMIN}/agents`]: { status: 403, body: errorBody('GATEWAY_FORBIDDEN', 'Refusé.') },
    });
    render(<ClaimsQueue />);
    const table = await screen.findByRole('table', { name: 'Réclamations du Nettoyage' });
    expect(within(table).getByRole('link', { name: 'Réclamation — Travail incomplet' })).toHaveAttribute(
      'href',
      `/nettoyage/reclamations/${claimIds.claim}`,
    );
    expect(within(table).getAllByText('Prendre en charge')).not.toHaveLength(0);
    expect(within(table).getAllByText('Plus de 24 h sans réponse')).not.toHaveLength(0);
    expect(within(table).getAllByText('Afi Mensah')).not.toHaveLength(0);
    expect(screen.getByText('1 réclamation')).toBeInTheDocument();
    const listCall = calls.find((call) => call.path === CLAIMS && !call.search.includes('limit=1'));
    const query = new URLSearchParams(listCall?.search);
    expect(query.get('status')).toBe('open');
    expect(query.get('sort')).toBe('-openedAt');
    const counter = await screen.findByRole('button', { name: /Nouvelles/ });
    expect(counter).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(counter).toHaveTextContent('3'));
    fireEvent.click(screen.getByRole('button', { name: /En cours/ }));
    expect(replace).toHaveBeenLastCalledWith('/nettoyage/reclamations?statut=in_progress&tri=-openedAt');
  });

  it('file vide, puis rôle sans `cleaning.claim.manage` : aucun appel', async () => {
    stubGateway({ [`GET ${CLAIMS}`]: page([]), [`GET ${ADMIN}/agents`]: page([]) });
    const { unmount } = render(<ClaimsQueue />);
    expect(await screen.findByText('Aucune réclamation pour l’instant.')).toBeInTheDocument();
    unmount();
    session.set(sessionBody(['finance_agent']));
    const { calls } = stubGateway({});
    render(<ClaimsQueue />);
    expect(await screen.findByText('Votre rôle ne donne pas accès à cet écran.')).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });
});

describe('réclamations : fiche', () => {
  it(
    'liens vers la séance et le programme, prise en charge puis réponse au client',
    async () => {
      const answered = claim({
        status: 'in_progress',
        firstResponseAt: '2026-11-22T08:00:00Z',
        messages: [
          ...claim().messages,
          {
            id: claimIds.redo,
            author: 'staff',
            authorId: TEST_USER.id,
            text: 'Nous repassons.',
            at: '2026-11-22T08:00:00Z',
          },
        ],
      });
      const { calls } = stubGateway({
        [`GET ${CLAIM}`]: ok(claim()),
        [`PATCH ${CLAIM}`]: [
          ok(claim({ status: 'in_progress', firstResponseAt: '2026-11-22T07:00:00Z' })),
          ok(answered),
        ],
      });
      render(<ClaimDetail id={claimIds.claim} />);
      expect(
        await screen.findByRole('heading', { level: 1, name: 'Réclamation — Travail incomplet' }),
      ).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Ouvrir la séance' })).toHaveAttribute(
        'href',
        `/nettoyage/programmes/${claimIds.program}/seances/${claimIds.session}`,
      );
      expect(screen.getByRole('link', { name: 'Ouvrir le programme' })).toHaveAttribute(
        'href',
        `/nettoyage/programmes/${claimIds.program}`,
      );
      expect(screen.getByText('Merci de me rappeler.')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Photo 1' })).toHaveAttribute(
        'href',
        'https://files.test/claim.jpg',
      );
      fireEvent.click(screen.getByRole('button', { name: 'Prendre en charge' }));
      expect(await screen.findByText('Réclamation prise en charge.')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Prendre en charge' })).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Envoyer la réponse' }));
      expect(await screen.findByText('Écrivez votre réponse.')).toBeInTheDocument();
      fireEvent.change(screen.getByLabelText('Réponse au client'), {
        target: { value: ' Nous repassons. ' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Envoyer la réponse' }));
      expect(await screen.findByText('Réponse envoyée au client.')).toBeInTheDocument();
      expect(screen.getByText('Nous repassons.')).toBeInTheDocument();
      const patches = calls.filter((call) => call.method === 'PATCH');
      expect(patches.map((call) => call.body)).toEqual([
        { status: 'in_progress' },
        { message: 'Nous repassons.' },
      ]);
      expect(patches[0]?.headers['Idempotency-Key']).toBeTruthy();
      expect(patches[1]?.headers['Idempotency-Key']).not.toBe(patches[0]?.headers['Idempotency-Key']);
    },
    SLOW,
  );

  it(
    'décision de crédit confirmée avec motif ; nouvel essai avec la même clé ; validation en attente',
    async () => {
      const { calls } = stubGateway({
        [`GET ${CLAIM}`]: ok(claim({ status: 'in_progress' })),
        [`POST ${CLAIM}/decision`]: [
          { status: 504, body: errorBody('GATEWAY_TIMEOUT', 'Délai dépassé.') },
          ok(claim({ status: 'in_progress', decision: creditDecision({ decidedBy: TEST_USER.id }) })),
        ],
      });
      render(<ClaimDetail id={claimIds.claim} />);
      fireEvent.click(await screen.findByRole('button', { name: 'Décider' }));
      const dialog = screen.getByRole('dialog', { name: 'Décider de la réclamation' });
      const confirm = () =>
        fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmer la décision' }));
      confirm();
      expect(await within(dialog).findByText('Choisissez une décision.')).toBeInTheDocument();
      fireEvent.change(within(dialog).getByLabelText('Décision'), { target: { value: 'wallet_credit' } });
      fireEvent.change(within(dialog).getByLabelText('Motif de la décision'), {
        target: { value: 'Cuisine non faite' },
      });
      confirm();
      expect(await within(dialog).findByText('Saisissez le montant du crédit.')).toBeInTheDocument();
      fireEvent.change(within(dialog).getByLabelText('Montant du crédit (FCFA)'), {
        target: { value: '60 000' },
      });
      confirm();
      expect(await within(dialog).findByText(/Délai dépassé/)).toBeInTheDocument();
      confirm();
      expect(await screen.findByText(/le crédit attend la validation/)).toBeInTheDocument();
      const posts = calls.filter((call) => call.method === 'POST');
      expect(posts[1]?.body).toEqual({
        outcome: 'wallet_credit',
        reason: 'Cuisine non faite',
        creditAmount: { amount: 60000, currency: 'XOF' },
      });
      expect(posts[1]?.headers['Idempotency-Key']).toBe(posts[0]?.headers['Idempotency-Key']);
      expect(screen.getByText('En attente d’une deuxième personne')).toBeInTheDocument();
      expect(screen.getByText(/une autre personne doit valider le crédit/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Valider le crédit' })).toBeNull();
    },
    SLOW,
  );

  it(
    'crédit validé par une deuxième personne ; montant masqué sans `cleaning.amounts.read`',
    async () => {
      const hidden = creditDecision();
      delete (hidden as Record<string, unknown>).creditAmount;
      const { calls } = stubGateway({
        [`GET ${CLAIM}`]: ok(claim({ status: 'in_progress', decision: hidden })),
        [`POST ${CLAIM}/decision/approve`]: ok(
          claim({
            status: 'resolved',
            decision: { ...hidden, approvalStatus: 'approved', approvedBy: TEST_USER.id },
          }),
        ),
      });
      render(<ClaimDetail id={claimIds.claim} />);
      expect(await screen.findByText('Montant masqué')).toBeInTheDocument();
      expect(screen.getByText(/par Ama Houngbo/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Valider le crédit' }));
      const dialog = screen.getByRole('dialog', { name: 'Valider le crédit' });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Valider et verser' }));
      expect(await screen.findByText('Crédit validé et versé.')).toBeInTheDocument();
      expect(screen.getByText('Réclamation close : plus aucun geste possible.')).toBeInTheDocument();
      const post = calls.find((call) => call.method === 'POST');
      expect(post?.path).toBe(`${CLAIM}/decision/approve`);
      expect(post?.headers['Idempotency-Key']).toBeTruthy();
    },
    SLOW,
  );

  it('réclamation introuvable', async () => {
    stubGateway({
      [`GET ${CLAIM}`]: {
        status: 404,
        body: errorBody('CLEANING_CLAIM_NOT_FOUND', 'Réclamation introuvable.'),
      },
    });
    render(<ClaimDetail id={claimIds.claim} />);
    expect(await screen.findByText(/Élément introuvable/)).toBeInTheDocument();
  });
});
