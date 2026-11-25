import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { session } from '@/lib/api';
import { errorBody, stubGateway, xof } from '@/lib/api/gateway.test-utils';
import { sessionBody, TEST_USER } from '@/lib/api/session.test-utils';
import { formatXof } from '@/lib/format';
import { WithdrawalsList } from './withdrawals-list';

let search = '';
const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/finance/portefeuilles/retraits',
  useSearchParams: () => new URLSearchParams(search),
}));

const LIST = '/api/v1/admin/wallet/withdrawals';
const id = (suffix: string) => `0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d${suffix}`;
const COLLEAGUE = id('9e99');
const AMOUNT = formatXof(25000);

function withdrawal(overrides: Record<string, unknown> = {}) {
  return {
    id: id('5001'),
    holder: { type: 'user', id: id('9e30') },
    amount: xof(25000),
    status: 'requested',
    beneficiaryOperator: 'mtn',
    beneficiaryPhoneMasked: '+229 •• •• 45',
    requestedBy: id('9e30'),
    requestedAt: '2026-11-20T09:00:00Z',
    processedBy: null,
    processedAt: null,
    processingNote: null,
    approvedBy: null,
    approvedAt: null,
    rejectedAt: null,
    rejectionReason: null,
    paymentPayoutId: null,
    completedAt: null,
    failedAt: null,
    ...overrides,
  };
}

const page = (items: unknown[]) => ({ status: 200, body: { data: items, nextCursor: null } });
const awaiting = (processedBy: string) =>
  withdrawal({
    id: id('5002'),
    status: 'awaiting_approval',
    processedBy,
    processedAt: '2026-11-20T10:00:00Z',
    processingNote: 'Titulaire joint par téléphone.',
  });

beforeEach(() => {
  search = '';
  replace.mockReset();
  session.set(sessionBody(['finance_officer']));
});

afterEach(() => vi.unstubAllGlobals());

async function openDialog(name: string) {
  fireEvent.click(await screen.findByRole('button', { name }));
  return screen.getByRole('dialog');
}

describe('file des retraits', () => {
  it('lit les filtres de l’adresse (état, titulaire) et affiche le suivi', async () => {
    search = `etat=awaiting_approval&type=particulier&titulaire=${id('9e30')}`;
    const { calls } = stubGateway({ [`GET ${LIST}`]: page([awaiting(COLLEAGUE)]) });
    render(<WithdrawalsList />);
    expect(await screen.findByText('Vérifications : Titulaire joint par téléphone.')).toBeInTheDocument();
    expect(decodeURIComponent(calls[0]?.search ?? '')).toBe(
      `?limit=20&status=awaiting_approval&holderType=user&holderId=${id('9e30')}`,
    );
    expect(screen.getByText(/Traité le .* par un autre membre de la finance/)).toBeInTheDocument();
    expect(screen.getAllByText('+229 •• •• 45').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Ouvrir le portefeuille (Particulier)' })).toHaveAttribute(
      'href',
      `/finance/portefeuilles/particulier/${id('9e30')}`,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Retirer le filtre « Titulaire sélectionné »' }));
    expect(replace).toHaveBeenCalledWith('/finance/portefeuilles/retraits?etat=awaiting_approval', {
      scroll: false,
    });
  });

  it('traiter : vérifications obligatoires, confirmées, puis liste relue', async () => {
    const { calls } = stubGateway({
      [`GET ${LIST}`]: [page([withdrawal()]), page([])],
      [`POST ${LIST}/${id('5001')}/process`]: { status: 200, body: awaiting(TEST_USER.id) },
    });
    render(<WithdrawalsList />);
    const dialog = await openDialog(`Traiter le retrait de ${AMOUNT}`);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Marquer comme traité' }));
    expect(await within(dialog).findByText('Indiquez les vérifications faites.')).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText(/Vérifications faites/), {
      target: { value: 'Numéro confirmé par appel.' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Marquer comme traité' }));
    expect(await screen.findByText(/traité : il attend la validation/)).toBeInTheDocument();
    expect(calls.find((call) => call.method === 'POST')?.body).toEqual({
      note: 'Numéro confirmé par appel.',
    });
    await waitFor(() => expect(calls.filter((call) => call.method === 'GET')).toHaveLength(2));
  });

  it('valider : réservé à une autre personne que celle qui a traité', async () => {
    const { calls } = stubGateway({
      [`GET ${LIST}`]: page([awaiting(COLLEAGUE)]),
      [`POST ${LIST}/${id('5002')}/approve`]: {
        status: 200,
        body: { ...awaiting(COLLEAGUE), status: 'submitted', approvedBy: TEST_USER.id },
      },
    });
    render(<WithdrawalsList />);
    const dialog = await openDialog(`Valider et transmettre le retrait de ${AMOUNT}`);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Valider et transmettre' }));
    expect(await screen.findByText(/validé et transmis pour le virement/)).toBeInTheDocument();
    const post = calls.find((call) => call.method === 'POST');
    expect(post?.path).toBe(`${LIST}/${id('5002')}/approve`);
    expect(post?.body).toBeUndefined();
  });

  it('celui qui a traité ne voit pas « Valider » ; le refus reste possible', async () => {
    stubGateway({ [`GET ${LIST}`]: page([awaiting(TEST_USER.id)]) });
    render(<WithdrawalsList />);
    expect(await screen.findByText(/Traité par vous : une autre personne/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Valider et transmettre/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: `Refuser le retrait de ${AMOUNT}` })).toBeInTheDocument();
  });

  it('valider : refus du service pour le même agent, message lisible', async () => {
    stubGateway({
      [`GET ${LIST}`]: page([awaiting(COLLEAGUE)]),
      [`POST ${LIST}/${id('5002')}/approve`]: {
        status: 403,
        body: errorBody('WALLET_APPROVAL_BY_PROCESSOR', 'Refusé.'),
      },
    });
    render(<WithdrawalsList />);
    const dialog = await openDialog(`Valider et transmettre le retrait de ${AMOUNT}`);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Valider et transmettre' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Vous avez traité ce retrait : il doit être validé par une autre personne de la finance.',
    );
  });

  it('refuser : motif obligatoire ; retrait changé entre-temps → liste relue', async () => {
    const { calls } = stubGateway({
      [`GET ${LIST}`]: page([withdrawal()]),
      [`POST ${LIST}/${id('5001')}/reject`]: {
        status: 422,
        body: errorBody('WALLET_WITHDRAWAL_INVALID_TRANSITION', 'Transition invalide.'),
      },
    });
    render(<WithdrawalsList />);
    const dialog = await openDialog(`Refuser le retrait de ${AMOUNT}`);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Refuser le retrait' }));
    expect(await within(dialog).findByText('Indiquez le motif.')).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText(/Motif/), {
      target: { value: 'Numéro au nom d’un tiers' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Refuser le retrait' }));
    await waitFor(() => expect(calls.filter((call) => call.method === 'GET')).toHaveLength(2));
    expect(calls.find((call) => call.method === 'POST')?.body).toEqual({
      reason: 'Numéro au nom d’un tiers',
    });
  });

  it('sans rôle de la finance : lecture seule, aucune décision', async () => {
    session.set(sessionBody(['cleaning_admin']));
    stubGateway({ [`GET ${LIST}`]: page([withdrawal(), awaiting(COLLEAGUE)]) });
    render(<WithdrawalsList />);
    expect(await screen.findAllByText('Particulier')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /^Traiter|^Valider|^Refuser/ })).not.toBeInTheDocument();
  });
});
