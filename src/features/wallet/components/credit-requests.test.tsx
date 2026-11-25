import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { session } from '@/lib/api';
import { errorBody, stubGateway, xof } from '@/lib/api/gateway.test-utils';
import { sessionBody, TEST_USER } from '@/lib/api/session.test-utils';
import { formatXof } from '@/lib/format';
import { CreditRequestsList } from './credit-requests-list';
import { PendingSummary } from './pending-summary';
import { WalletPayoutsList } from './wallet-payouts-list';

let search = '';
const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/finance/portefeuilles/demandes-de-credit',
  useSearchParams: () => new URLSearchParams(search),
}));

const ADMIN = '/api/v1/admin/wallet';
const LIST = `${ADMIN}/credit-requests`;
const id = (suffix: string) => `0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d${suffix}`;
const AMOUNT = formatXof(80000);

function request(overrides: Record<string, unknown> = {}) {
  return {
    id: id('6001'),
    holder: { type: 'organization', id: id('0a01') },
    kind: 'cash_top_up',
    amount: xof(80000),
    reason: 'Recharge en espèces au guichet de Cotonou',
    paymentId: null,
    status: 'pending_approval',
    requestedBy: id('9e99'),
    requestedAt: '2026-11-20T09:00:00Z',
    approvedBy: null,
    approvedAt: null,
    transactionId: null,
    receiptReference: 'REC-2026-0042',
    forObject: null,
    rejectedBy: null,
    rejectedAt: null,
    rejectionReason: null,
    ...overrides,
  };
}

const withdrawal = (suffix: string) => ({
  id: id(suffix),
  holder: { type: 'user', id: id('9e30') },
  amount: xof(25000),
  status: 'requested',
  beneficiaryOperator: 'mtn',
  beneficiaryPhoneMasked: '+229 •• •• 45',
  requestedBy: id('9e30'),
  requestedAt: '2026-11-20T09:00:00Z',
  processedBy: null,
  processedAt: null,
  approvedBy: null,
  approvedAt: null,
  rejectedAt: null,
  rejectionReason: null,
  paymentPayoutId: null,
  completedAt: null,
  failedAt: null,
});

const items = (list: unknown[], nextCursor: string | null = null) => ({
  status: 200,
  body: { items: list, nextCursor },
});

beforeEach(() => {
  search = '';
  replace.mockReset();
  session.set(sessionBody(['finance_officer']));
});

afterEach(() => vi.unstubAllGlobals());

describe('demandes de crédit', () => {
  it('lit `items`, filtre par état, et valide une demande d’un autre membre', async () => {
    search = 'etat=pending_approval';
    const { calls } = stubGateway({
      [`GET ${LIST}`]: [items([request()]), items([])],
      [`POST ${LIST}/${id('6001')}/approve`]: {
        status: 200,
        body: {
          transactionId: id('7c01'),
          kind: 'cash_top_up',
          amount: xof(80000),
          description: 'Recharge en espèces',
          createdAt: '2026-11-20T10:00:00Z',
          wallet: {
            holder: { type: 'organization', id: id('0a01') },
            balance: xof(95000),
            lastEntryAt: null,
          },
          request: request({ status: 'approved', approvedBy: TEST_USER.id }),
          created: true,
        },
      },
    });
    render(<CreditRequestsList />);
    expect(await screen.findByText('Reçu ou virement : REC-2026-0042')).toBeInTheDocument();
    expect(decodeURIComponent(calls[0]?.search ?? '')).toBe('?limit=20&status=pending_approval');
    expect(screen.getByText(/par un autre membre de la finance/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: `Valider et créditer ${AMOUNT}` }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/crédité aussitôt/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Valider et créditer' }));
    expect(
      await screen.findByText(/crédités sur le portefeuille\. Nouveau solde : 95\s000/),
    ).toBeInTheDocument();
    expect(calls.find((call) => call.method === 'POST')?.body).toBeUndefined();
    await waitFor(() => expect(calls.filter((call) => call.method === 'GET')).toHaveLength(2));
  });

  it('l’auteur ne voit pas « Valider » et peut rejeter sa demande pour l’annuler', async () => {
    const { calls } = stubGateway({
      [`GET ${LIST}`]: items([request({ requestedBy: TEST_USER.id })]),
      [`POST ${LIST}/${id('6001')}/reject`]: {
        status: 200,
        body: request({ status: 'rejected', rejectionReason: 'Doublon' }),
      },
    });
    render(<CreditRequestsList />);
    expect(await screen.findByText(/Votre demande : un autre membre/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Valider et créditer/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: `Rejeter la demande de ${AMOUNT}` }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/Rejeter votre propre demande l’annule/)).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText(/Motif/), { target: { value: 'Doublon' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Rejeter la demande' }));
    expect(await screen.findByText(/rejetée : rien n’a été crédité/)).toBeInTheDocument();
    expect(calls.find((call) => call.method === 'POST')?.body).toEqual({ reason: 'Doublon' });
  });

  it('erreurs métier : auteur refusé par le service, demande plus en attente (liste relue)', async () => {
    const { calls } = stubGateway({
      [`GET ${LIST}`]: items([request()]),
      [`POST ${LIST}/${id('6001')}/approve`]: {
        status: 403,
        body: errorBody('WALLET_APPROVAL_BY_REQUESTER', 'Refusé.'),
      },
      [`POST ${LIST}/${id('6001')}/reject`]: {
        status: 422,
        body: errorBody('WALLET_CREDIT_REQUEST_NOT_PENDING', 'Plus en attente.'),
      },
    });
    render(<CreditRequestsList />);
    fireEvent.click(await screen.findByRole('button', { name: `Valider et créditer ${AMOUNT}` }));
    let dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Valider et créditer' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Vous avez fait cette demande : elle doit être validée par un autre membre de la finance.',
    );
    fireEvent.click(within(dialog).getByRole('button', { name: 'Annuler' }));

    fireEvent.click(screen.getByRole('button', { name: `Rejeter la demande de ${AMOUNT}` }));
    dialog = screen.getAllByRole('dialog').at(-1) as HTMLElement;
    fireEvent.change(within(dialog).getByLabelText(/Motif/), { target: { value: 'Reçu introuvable' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Rejeter la demande' }));
    await waitFor(() => expect(calls.filter((call) => call.method === 'GET')).toHaveLength(2));
  });
});

describe('reversements des titulaires', () => {
  it('liste en lecture seule, filtrée par état et titulaire, avec le lien vers l’exécution', async () => {
    search = `etat=pending_submission&type=entreprise&titulaire=${id('0a01')}`;
    const { calls } = stubGateway({
      [`GET ${ADMIN}/payouts`]: {
        status: 200,
        body: {
          data: [
            {
              id: id('4001'),
              holder: { type: 'organization', id: id('0a01') },
              amount: xof(60000),
              status: 'pending_submission',
              paymentPayoutId: null,
              beneficiaryOperator: 'moov',
              beneficiaryPhoneMasked: '+229 •• •• 12',
              createdAt: '2026-11-20T09:00:00Z',
              updatedAt: '2026-11-20T09:00:00Z',
              completedAt: null,
              failedAt: null,
            },
          ],
          nextCursor: null,
        },
      },
    });
    render(<WalletPayoutsList />);
    expect(await screen.findByText('En attente de transmission', { selector: 'span' })).toBeInTheDocument();
    expect(decodeURIComponent(calls[0]?.search ?? '')).toBe(
      `?limit=20&status=pending_submission&holderType=organization&holderId=${id('0a01')}`,
    );
    expect(screen.getByRole('link', { name: 'Ouvrir les reversements Mobile Money' })).toHaveAttribute(
      'href',
      '/finance/reversements',
    );
    expect(screen.queryByRole('button', { name: /Confirmer|Valider/ })).not.toBeInTheDocument();
  });
});

describe('en attente d’une action (vue d’ensemble)', () => {
  it('compte chaque file, « 20+ » au-delà d’une page, et masque les files vides', async () => {
    const withdrawals = (_body: unknown, url: URL) =>
      url.searchParams.get('status') === 'requested'
        ? { status: 200, body: { data: [withdrawal('5001'), withdrawal('5002')], nextCursor: null } }
        : { status: 200, body: { data: [], nextCursor: null } };
    stubGateway({
      [`GET ${ADMIN}/withdrawals`]: withdrawals,
      [`GET ${LIST}`]: items(
        Array.from({ length: 20 }, (_, index) => request({ id: id(`6${index}`) })),
        'c2',
      ),
    });
    render(<PendingSummary />);
    expect(await screen.findByRole('link', { name: 'Retraits à traiter : 2' })).toHaveAttribute(
      'href',
      '/finance/portefeuilles/retraits?etat=requested',
    );
    expect(screen.getByRole('link', { name: 'Demandes de crédit à valider : 20+' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Retraits à valider/ })).not.toBeInTheDocument();
  });
});
