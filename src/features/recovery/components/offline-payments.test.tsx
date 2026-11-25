import { fireEvent, render, screen, within } from '@testing-library/react';
import { session } from '@/lib/api';
import { errorBody, stubGateway, xof } from '@/lib/api/gateway.test-utils';
import { sessionBody, TEST_USER } from '@/lib/api/session.test-utils';
import {
  adminCase,
  CASE_ID,
  collection,
  journalPage,
  offlinePayment,
  recoveryCase,
} from '@/features/recovery/case-fixtures.test-utils';
import { ADMIN, staff, uuid } from '@/features/recovery/fixtures.test-utils';
import { CaseDetail } from './case-detail';
import { OfflinePayments } from './offline-payments';

let search = '';
const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: replace }),
  usePathname: () => '/recouvrement/paiements-hors-ligne',
  useSearchParams: () => new URLSearchParams(search),
}));

beforeEach(() => {
  search = '';
  replace.mockReset();
  session.set(sessionBody(['finance_officer']));
});
afterEach(() => vi.unstubAllGlobals());

const ok = (body: unknown) => ({ status: 200, body });
const CASE = `${ADMIN}/cases/${CASE_ID}`;
const PAYMENT = uuid('0f01');
const OWN = uuid('0f02');

describe('paiements hors ligne', () => {
  it('saisie depuis la fiche : corps du contrat, clé d’idempotence', async () => {
    const { calls } = stubGateway({
      [`GET ${CASE}`]: ok(adminCase()),
      [`GET ${CASE}/journal`]: ok(journalPage([])),
      [`POST ${CASE}/offline-payments`]: ok(
        offlinePayment({ recordedBy: staff(TEST_USER.id, 'Koffi Adjovi') }),
      ),
    });
    render(<CaseDetail id={CASE_ID} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Saisir un paiement hors ligne' }));
    const dialog = screen.getByRole('dialog', { name: 'Saisir un paiement hors ligne' });
    fireEvent.change(within(dialog).getByLabelText('Origine'), { target: { value: 'transfer' } });
    fireEvent.change(within(dialog).getByLabelText('Montant reçu (F CFA)'), { target: { value: '75000' } });
    fireEvent.change(within(dialog).getByLabelText('Reçu le'), { target: { value: '2026-11-24' } });
    fireEvent.change(within(dialog).getByLabelText(/Référence du virement/), {
      target: { value: 'VIR-TEST-1' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByText(/il attend la validation d’une autre personne/)).toBeInTheDocument();
    const post = calls.find((call) => call.method === 'POST');
    expect(post?.body).toEqual({
      source: 'transfer',
      amount: xof(75000),
      receivedOn: '2026-11-24',
      reference: 'VIR-TEST-1',
    });
    expect(post?.headers['Idempotency-Key']).toBeTruthy();
  });

  it('file « À valider » : validation par une autre personne, masquée pour l’auteur', async () => {
    const mine = offlinePayment({
      id: OWN,
      recordedBy: staff(TEST_USER.id, 'Koffi Adjovi'),
      reference: null,
    });
    const { calls } = stubGateway({
      [`GET ${ADMIN}/offline-payments`]: ok({ payments: [offlinePayment(), mine], nextCursor: null }),
      [`POST ${ADMIN}/offline-payments/${PAYMENT}/approve`]: ok({
        payment: offlinePayment({
          status: 'approved',
          approvedBy: staff(TEST_USER.id, 'Koffi Adjovi'),
          collectionId: uuid('c201'),
        }),
        collection: collection(),
      }),
    });
    render(<OfflinePayments />);
    const table = await screen.findByRole('table', { name: 'Paiements hors ligne' });
    expect(calls[0]?.search).toBe('?limit=20&status=pending_approval');
    expect(within(table).getAllByRole('link', { name: 'Ouvrir le dossier RC-2026-0001' })[0]).toHaveAttribute(
      'href',
      `/recouvrement/dossiers/${CASE_ID}`,
    );
    expect(
      screen.getByText('Vous avez saisi ce paiement : sa validation revient à une autre personne.'),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Valider le paiement/ })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /^Refuser le paiement/ })).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: /^Valider le paiement/ }));
    const dialog = screen.getByRole('dialog', { name: 'Valider le paiement hors ligne' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Valider' }));
    expect(
      await screen.findByText(/Paiement validé : 75\s000.* imputé, 67\s500.* crédité au créancier\./),
    ).toBeInTheDocument();
    expect(screen.getByText('Validé par Koffi Adjovi')).toBeInTheDocument();
    expect(calls.at(-1)?.body).toEqual({});
  });

  it('refus motivé ; validation refusée par le service (auteur) lisible', async () => {
    const { calls } = stubGateway({
      [`GET ${ADMIN}/offline-payments`]: ok({ payments: [offlinePayment()], nextCursor: null }),
      [`POST ${ADMIN}/offline-payments/${PAYMENT}/approve`]: {
        status: 403,
        body: errorBody('RECOVERY_APPROVAL_BY_REQUESTER', 'Validé par une seconde personne.'),
      },
      [`POST ${ADMIN}/offline-payments/${PAYMENT}/reject`]: ok(
        offlinePayment({ status: 'rejected', rejectionReason: 'Reçu illisible.' }),
      ),
    });
    render(<OfflinePayments />);
    fireEvent.click(await screen.findByRole('button', { name: /^Valider le paiement/ }));
    const approve = screen.getByRole('dialog', { name: 'Valider le paiement hors ligne' });
    fireEvent.click(within(approve).getByRole('button', { name: 'Valider' }));
    expect(
      await within(approve).findByText(/sa validation revient à une autre personne/),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Refuser le paiement/ }));
    const reject = screen.getByRole('dialog', { name: 'Refuser le paiement hors ligne' });
    fireEvent.click(within(reject).getByRole('button', { name: 'Refuser' }));
    expect(await within(reject).findByText(/motif de 3 à 1 000/)).toBeInTheDocument();
    fireEvent.change(within(reject).getByLabelText('Motif du refus'), {
      target: { value: 'Reçu illisible.' },
    });
    fireEvent.click(within(reject).getByRole('button', { name: 'Refuser' }));
    expect(await screen.findByText('Paiement refusé.')).toBeInTheDocument();
    expect(screen.getByText('Motif : Reçu illisible.')).toBeInTheDocument();
    expect(calls.at(-1)?.body).toEqual({ reason: 'Reçu illisible.' });
  });

  it('état choisi dans l’adresse (« Tous » compris)', async () => {
    search = 'etat=tous';
    const { calls } = stubGateway({
      [`GET ${ADMIN}/offline-payments`]: ok({ payments: [], nextCursor: null }),
    });
    render(<OfflinePayments />);
    expect(await screen.findByText('Aucun paiement pour ces critères.')).toBeInTheDocument();
    expect(calls[0]?.search).toBe('?limit=20');
    fireEvent.change(screen.getByLabelText('État'), { target: { value: 'rejected' } });
    expect(replace).toHaveBeenCalledWith('/recouvrement/paiements-hors-ligne?etat=rejected');
  });

  it('trop-perçu : remboursement tracé, plafonné au trop-perçu', async () => {
    const overpaid = { ...recoveryCase().amounts, overpaid: xof(20000) };
    const { calls } = stubGateway({
      [`GET ${CASE}`]: ok(adminCase({ amounts: overpaid })),
      [`GET ${CASE}/journal`]: ok(journalPage([])),
      [`POST ${CASE}/overpayment-refunds`]: ok(recoveryCase()),
    });
    render(<CaseDetail id={CASE_ID} />);
    expect(await screen.findByText('Trop-perçu à rembourser')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le remboursement du trop-perçu' }));
    const dialog = screen.getByRole('dialog', { name: 'Enregistrer le remboursement du trop-perçu' });
    fireEvent.change(within(dialog).getByLabelText('Montant remboursé (F CFA)'), {
      target: { value: '25000' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer' }));
    expect(
      await within(dialog).findByText('Le montant ne peut pas dépasser le trop-perçu.'),
    ).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText('Montant remboursé (F CFA)'), {
      target: { value: '20000' },
    });
    fireEvent.change(within(dialog).getByLabelText('Référence du remboursement'), {
      target: { value: 'FA-TEST-1' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByText('Remboursement enregistré : trop-perçu soldé.')).toBeInTheDocument();
    const post = calls.find((call) => call.method === 'POST');
    expect(post?.body).toEqual({ amount: xof(20000), reference: 'FA-TEST-1' });
    expect(post?.headers['Idempotency-Key']).toBeTruthy();
  });
});
