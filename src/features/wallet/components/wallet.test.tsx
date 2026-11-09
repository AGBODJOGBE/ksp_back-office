import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { session } from '@/lib/api';
import { errorBody, stubGateway, xof } from '@/lib/api/gateway.test-utils';
import { sessionBody } from '@/lib/api/session.test-utils';
import { walletAccess } from '@/features/wallet/access';
import { holderTypeOf, walletPaths } from '@/features/wallet/texts';
import { HolderWallet } from './holder-wallet';
import { WalletsOverview } from './wallets-overview';

let search = '';
const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/finance/portefeuilles/particulier/u1',
  useSearchParams: () => new URLSearchParams(search),
}));

const ADMIN = '/api/v1/admin/wallet';
const ids = {
  user: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d9e30',
  organization: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d0a01',
  mission: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d2001',
  topUp: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d8101',
};
const HOLDER = `${ADMIN}/holders/user/${ids.user}`;

const prepaid = (amount: number) => ({
  holder: { type: 'user', id: ids.user },
  balance: xof(amount),
  lastEntryAt: '2026-11-03T09:00:00Z',
});

function wallet(overrides: Record<string, unknown> = {}) {
  return {
    holder: { type: 'user', id: ids.user },
    balance: xof(0),
    payoutsInProgress: xof(0),
    totalCollected: xof(0),
    totalPaidOut: xof(0),
    lastEntryAt: null,
    prepaid: prepaid(15000),
    ...overrides,
  };
}

const line = (overrides: Record<string, unknown> = {}) => ({
  transactionId: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d7c01',
  account: 'prepaid',
  kind: 'service_payment',
  direction: 'debit',
  amount: xof(5000),
  balanceAfter: xof(15000),
  reference: 'cleaning:x',
  description: 'Nettoyage de maison — acompte',
  grossAmount: null,
  commission: null,
  commissionRateBps: null,
  payoutId: null,
  payoutStatus: null,
  reversesTransactionId: null,
  createdAt: '2026-11-03T09:00:00Z',
  object: { service: 'cleaning', objectType: 'cleaning_mission', objectId: ids.mission, part: 'deposit' },
  ...overrides,
});

beforeEach(() => {
  search = '';
  replace.mockReset();
  session.set(sessionBody(['finance_officer']));
});

afterEach(() => vi.unstubAllGlobals());

describe('droits et adresses des portefeuilles', () => {
  it('suivent les rôles du contrat', () => {
    expect(walletAccess(['finance_officer'])).toEqual({ wallets: true, searchByPhone: false });
    expect(walletAccess(['super_admin'])).toEqual({ wallets: true, searchByPhone: true });
    expect(walletAccess(['cleaning_admin']).wallets).toBe(false);
  });

  it('nomment le titulaire en français dans l’adresse', () => {
    expect(walletPaths.holder('organization', ids.organization)).toBe(
      `/finance/portefeuilles/entreprise/${ids.organization}`,
    );
    expect(holderTypeOf('particulier')).toBe('user');
    expect(holderTypeOf('user')).toBeNull();
  });
});

describe('vue d’ensemble', () => {
  const overview = {
    internalAccounts: [
      { account: 'ksp:prepaid_funds', balance: xof(250000) },
      { account: 'ksp:service_revenue', balance: xof(70000) },
    ],
    owedToHolders: xof(90000),
    holdersCount: 3,
    owedToCustomers: xof(180000),
    customersCount: 12,
  };

  it('montre le dû aux clients, aux créanciers et les comptes internes, sans recherche pour la finance', async () => {
    stubGateway({ [`GET ${ADMIN}/overview`]: { status: 200, body: overview } });
    render(<WalletsOverview />);
    expect(await screen.findByText('Dû aux clients')).toBeInTheDocument();
    expect(screen.getByText(/180\s000/)).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('3 créanciers')).toBeInTheDocument();
    expect(screen.getByText('Recharges reçues')).toBeInTheDocument();
    expect(screen.getByText('Services payés par portefeuille')).toBeInTheDocument();
    expect(screen.queryByLabelText('Numéro de téléphone du particulier')).not.toBeInTheDocument();
    expect(screen.getByText(/depuis un paiement en ligne/)).toBeInTheDocument();
  });

  it('retrouve un particulier par son numéro et ouvre son portefeuille', async () => {
    session.set(sessionBody(['super_admin']));
    const { calls } = stubGateway({
      [`GET ${ADMIN}/overview`]: { status: 200, body: overview },
      'POST /api/v1/admin/identity/accounts/lookup': {
        status: 200,
        body: {
          userId: ids.user,
          status: 'active',
          firstName: 'Afi',
          lastName: 'Dossou',
          phoneMasked: '+229********45',
        },
      },
    });
    render(<WalletsOverview />);
    fireEvent.change(await screen.findByLabelText('Numéro de téléphone du particulier'), {
      target: { value: '01 97 00 00 45' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Rechercher' }));
    expect(await screen.findByText('Afi Dossou')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ouvrir le portefeuille' })).toHaveAttribute(
      'href',
      `/finance/portefeuilles/particulier/${ids.user}`,
    );
    expect(calls.find((call) => call.method === 'POST')?.body).toEqual({ phone: '+2290197000045' });
  });
});

describe('portefeuille d’un titulaire', () => {
  it('affiche le solde prépayé et le relevé, sans fonds de créancier', async () => {
    const { calls } = stubGateway({
      [`GET ${HOLDER}`]: { status: 200, body: wallet() },
      [`GET ${HOLDER}/statement`]: {
        status: 200,
        body: {
          data: [
            line(),
            line({
              transactionId: 't2',
              kind: 'top_up',
              direction: 'credit',
              object: null,
              description: 'Recharge Mobile Money',
              amount: xof(20000),
              balanceAfter: xof(20000),
            }),
          ],
          nextCursor: null,
        },
      },
    });
    render(<HolderWallet type="user" id={ids.user} />);
    expect(await screen.findByRole('heading', { name: 'Portefeuille d’un particulier' })).toBeInTheDocument();
    expect(screen.getAllByText(/15\s000/).length).toBeGreaterThan(0);
    expect(await screen.findByText('Nettoyage de maison — acompte')).toBeInTheDocument();
    expect(screen.getByText('Paiement d’un service')).toBeInTheDocument();
    expect(screen.getByText(/^\+ 20\s000/)).toBeInTheDocument();
    expect(screen.getByText(/^− 5\s000/)).toBeInTheDocument();
    // finance_officer : le module Nettoyage est fermé, l'objet payé est nommé sans lien.
    expect(screen.getByText('Mission du Nettoyage, acompte')).not.toHaveAttribute('href');
    expect(screen.queryByText('Fonds dus au créancier')).not.toBeInTheDocument();
    expect(calls.find((call) => call.path.endsWith('/statement'))?.search).toBe('?limit=20&account=prepaid');
  });

  it('lit les fonds de créancier quand le titulaire en a (?compte=creancier)', async () => {
    search = 'compte=creancier';
    session.set(sessionBody(['super_admin']));
    const { calls } = stubGateway({
      [`GET ${HOLDER}`]: {
        status: 200,
        body: wallet({
          balance: xof(42000),
          totalCollected: xof(60000),
          lastEntryAt: '2026-11-01T09:00:00Z',
        }),
      },
      [`GET ${HOLDER}/statement`]: { status: 200, body: { data: [], nextCursor: null } },
    });
    render(<HolderWallet type="user" id={ids.user} />);
    expect(await screen.findByRole('heading', { name: 'Fonds dus au créancier' })).toBeInTheDocument();
    expect(screen.getByText(/42\s000/)).toBeInTheDocument();
    expect(await screen.findByText('Aucune opération sur ce compte.')).toBeInTheDocument();
    expect(calls.find((call) => call.path.endsWith('/statement'))?.search).toBe(
      '?limit=20&account=collections',
    );
    fireEvent.change(screen.getByLabelText('Compte'), { target: { value: 'prepaid' } });
    expect(replace).toHaveBeenCalledWith('/finance/portefeuilles/particulier/u1', { scroll: false });
  });
});

describe('créditer un portefeuille', () => {
  const credited = {
    transactionId: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d7c09',
    kind: 'refund',
    amount: xof(5000),
    description: 'Passage du 3 novembre non effectué',
    createdAt: '2026-11-09T10:00:00Z',
    wallet: prepaid(20000),
    created: true,
  };

  async function openDialog() {
    fireEvent.click(await screen.findByRole('button', { name: 'Créditer ou rembourser' }));
    return screen.getByRole('dialog', { name: 'Créditer le portefeuille prépayé' });
  }

  it('rembourse après vérification, avec la même clé à chaque essai, et met le solde à jour', async () => {
    const { calls } = stubGateway({
      [`GET ${HOLDER}`]: { status: 200, body: wallet() },
      [`GET ${HOLDER}/statement`]: { status: 200, body: { data: [line()], nextCursor: null } },
      [`POST ${HOLDER}/credits`]: [
        { status: 503, body: errorBody('GATEWAY_UNAVAILABLE', 'Service indisponible.') },
        { status: 200, body: credited },
      ],
    });
    render(<HolderWallet type="user" id={ids.user} />);
    const dialog = await openDialog();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Vérifier' }));
    expect(within(dialog).getByText(/Saisissez un montant en FCFA/)).toBeInTheDocument();
    expect(within(dialog).getByText('Indiquez le motif.')).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText('Montant à créditer (FCFA)'), {
      target: { value: '5 000' },
    });
    fireEvent.change(within(dialog).getByLabelText('Motif'), {
      target: { value: '  Passage du 3 novembre non effectué ' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Vérifier' }));
    expect(within(dialog).getByRole('heading', { name: 'Confirmer le crédit' })).toBeInTheDocument();
    expect(within(dialog).getByText(/ni modifié ni annulé/)).toBeInTheDocument();
    expect(calls.filter((call) => call.method === 'POST')).toHaveLength(0);

    const confirm = within(dialog).getByRole('button', { name: /^Créditer 5\s000/ });
    fireEvent.click(confirm);
    expect(await within(dialog).findByText(/Service indisponible/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: /^Créditer 5\s000/ }));
    expect(
      await screen.findByText(/crédités sur le portefeuille\. Nouveau solde : 20\s000/),
    ).toBeInTheDocument();

    const posts = calls.filter((call) => call.method === 'POST');
    expect(posts).toHaveLength(2);
    expect(posts[0]?.body).toEqual({
      kind: 'refund',
      amount: { amount: 5000, currency: 'XOF' },
      reason: 'Passage du 3 novembre non effectué',
    });
    expect(posts[0]?.headers['Idempotency-Key']).toMatch(/^[A-Za-z0-9_-]{8,100}$/);
    expect(posts[1]?.headers['Idempotency-Key']).toBe(posts[0]?.headers['Idempotency-Key']);
    // Relevé relu après le crédit.
    await waitFor(() => expect(calls.filter((call) => call.path.endsWith('/statement'))).toHaveLength(2));
  });

  it('crédite une recharge en écart choisie dans la liste du client', async () => {
    const { calls } = stubGateway({
      [`GET ${HOLDER}`]: { status: 200, body: wallet() },
      [`GET ${HOLDER}/statement`]: { status: 200, body: { data: [], nextCursor: null } },
      'GET /api/v1/admin/payment/payments': {
        status: 200,
        body: {
          data: [
            {
              id: ids.topUp,
              status: 'amount_mismatch',
              amount: xof(20000),
              providerReference: 'trx-77',
              createdAt: '2026-11-02T09:00:00Z',
              underReview: false,
            },
          ],
          nextCursor: null,
        },
      },
      [`POST ${HOLDER}/credits`]: [
        {
          status: 409,
          body: errorBody('WALLET_IDEMPOTENCY_KEY_REUSED', 'Déjà crédité.'),
        },
      ],
    });
    render(<HolderWallet type="user" id={ids.user} />);
    const dialog = await openDialog();
    fireEvent.click(within(dialog).getByLabelText(/Recharge reçue avec un écart/));
    const select = await within(dialog).findByLabelText('Recharge concernée');
    expect(calls.find((call) => call.path === '/api/v1/admin/payment/payments')?.search).toBe(
      `?limit=50&status=amount_mismatch&subjectType=wallet_top_up&subjectId=${ids.user}`,
    );
    fireEvent.click(within(dialog).getByRole('button', { name: 'Vérifier' }));
    expect(within(dialog).getByText('Choisissez la recharge concernée.')).toBeInTheDocument();

    fireEvent.change(select, { target: { value: ids.topUp } });
    fireEvent.change(within(dialog).getByLabelText('Montant à créditer (FCFA)'), {
      target: { value: '18000' },
    });
    fireEvent.change(within(dialog).getByLabelText('Motif'), { target: { value: 'Écart MTN vérifié' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Vérifier' }));
    fireEvent.click(within(dialog).getByRole('button', { name: /^Créditer 18\s000/ }));
    expect(await within(dialog).findByText(/Cette recharge a déjà été créditée/)).toBeInTheDocument();
    expect(calls.find((call) => call.method === 'POST')?.body).toEqual({
      kind: 'top_up',
      amount: { amount: 18000, currency: 'XOF' },
      reason: 'Écart MTN vérifié',
      paymentId: ids.topUp,
    });
  });

  it('demande l’identifiant du paiement quand la liste des recharges n’est pas lisible', async () => {
    stubGateway({
      [`GET ${HOLDER}`]: { status: 200, body: wallet() },
      [`GET ${HOLDER}/statement`]: { status: 200, body: { data: [], nextCursor: null } },
      'GET /api/v1/admin/payment/payments': { status: 403, body: errorBody('AUTH_FORBIDDEN', 'Refusé.') },
    });
    render(<HolderWallet type="user" id={ids.user} />);
    const dialog = await openDialog();
    fireEvent.click(within(dialog).getByLabelText(/Recharge reçue avec un écart/));
    expect(await within(dialog).findByLabelText('Identifiant du paiement')).toBeInTheDocument();
    expect(within(dialog).getByText(/n’a pas pu être lue/)).toBeInTheDocument();
  });
});
