import { fireEvent, render, screen, within } from '@testing-library/react';
import { session } from '@/lib/api';
import { stubGateway, xof } from '@/lib/api/gateway.test-utils';
import { sessionBody } from '@/lib/api/session.test-utils';
import { paymentAccess } from '@/features/payment/access';
import { PaymentsList } from './payments-list';

let search = '';
const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/finance/paiements',
  useSearchParams: () => new URLSearchParams(search),
}));

const PAYMENTS = '/api/v1/admin/payment/payments';
const ids = {
  mission: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d2001',
  invoice: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d7001',
  organization: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d0a01',
};

function payment(overrides: Record<string, unknown> = {}) {
  return {
    id: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d8001',
    status: 'succeeded',
    subject: { type: 'cleaning_mission', id: ids.mission, part: 'deposit', reference: null },
    amount: xof(1119000),
    customerId: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d9e30',
    organizationId: null,
    method: 'mobile_money_online',
    provider: 'fedapay',
    providerReference: 'trx-4521',
    checkoutUrl: null,
    failureReason: null,
    createdAt: '2026-10-30T09:00:00Z',
    updatedAt: '2026-10-30T09:02:00Z',
    expiresAt: '2026-10-30T09:30:00Z',
    completedAt: '2026-10-30T09:02:00Z',
    ...overrides,
  };
}

const mismatch = payment({
  id: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d8002',
  status: 'amount_mismatch',
  subject: { type: 'billing_invoice', id: ids.invoice, part: null, reference: 'FAC-2026-000012' },
  organizationId: ids.organization,
  amount: xof(120000),
});

beforeEach(() => {
  search = '';
  replace.mockReset();
  session.set(sessionBody(['super_admin']));
});

afterEach(() => vi.unstubAllGlobals());

describe('droits des paiements en ligne', () => {
  it('suit les rôles du contrat', () => {
    expect(paymentAccess(['finance_officer']).list).toBe(true);
    expect(paymentAccess(['cleaning_admin']).list).toBe(true);
    expect(paymentAccess(['cleaning_supervisor']).list).toBe(false);
  });
});

describe('paiements en ligne', () => {
  it('liste les paiements, signale ceux à examiner et lie l’objet payé', async () => {
    const { calls } = stubGateway({
      [`GET ${PAYMENTS}`]: (_body, url) => ({
        status: 200,
        body: {
          data: url.searchParams.get('status') === 'amount_mismatch' ? [mismatch] : [payment(), mismatch],
          nextCursor: null,
        },
      }),
    });
    render(<PaymentsList />);
    const mission = await screen.findByRole('link', { name: 'Mission du Nettoyage, acompte' });
    expect(mission).toHaveAttribute('href', `/nettoyage/missions/${ids.mission}`);
    expect(screen.getByRole('link', { name: 'Facture FAC-2026-000012' })).toHaveAttribute(
      'href',
      `/finance/factures/${ids.invoice}`,
    );
    expect(screen.getAllByText('À examiner (montant différent)').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Voir l’entreprise' })).toHaveAttribute(
      'href',
      `/clients/entreprises/${ids.organization}`,
    );
    expect(await screen.findByText(/Des paiements en ligne sont à examiner/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voir les paiements à examiner' })).toHaveAttribute(
      'href',
      '/finance/paiements?etat=amount_mismatch',
    );
    expect(screen.getAllByText('Réf. trx-4521').length).toBe(2);
    expect(calls.map((call) => call.search).sort()).toEqual(['?limit=1&status=amount_mismatch', '?limit=20']);
  });

  it('filtre par état, type d’objet et objet, sans alerte en double', async () => {
    search = `etat=amount_mismatch&objet=${ids.invoice}`;
    const { calls } = stubGateway({
      [`GET ${PAYMENTS}`]: { status: 200, body: { data: [mismatch], nextCursor: null } },
    });
    render(<PaymentsList />);
    await screen.findByRole('link', { name: 'Facture FAC-2026-000012' });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.search).toBe(`?limit=20&status=amount_mismatch&subjectId=${ids.invoice}`);
    expect(screen.queryByText(/Des paiements en ligne sont à examiner/)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Objet payé'), { target: { value: 'billing_invoice' } });
    expect(replace).toHaveBeenCalledWith(
      `/finance/paiements?etat=amount_mismatch&objet=${ids.invoice}&objet-type=billing_invoice`,
      { scroll: false },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Retirer le filtre « Objet sélectionné »' }));
    expect(replace).toHaveBeenLastCalledWith('/finance/paiements?etat=amount_mismatch', { scroll: false });
  });

  it('ne lie pas la mission pour la finance seule (module Nettoyage fermé)', async () => {
    session.set(sessionBody(['finance_officer']));
    stubGateway({ [`GET ${PAYMENTS}`]: { status: 200, body: { data: [payment()], nextCursor: null } } });
    render(<PaymentsList />);
    const table = await screen.findByRole('table');
    expect(await within(table).findByText('Mission du Nettoyage, acompte')).toBeInTheDocument();
    expect(within(table).queryByRole('link')).not.toBeInTheDocument();
    expect(within(table).getByText('Particulier')).toBeInTheDocument();
  });
});
