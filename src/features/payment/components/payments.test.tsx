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
    underReview: false,
    ...overrides,
  };
}

const mismatch = payment({
  id: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d8002',
  status: 'amount_mismatch',
  subject: { type: 'billing_invoice', id: ids.invoice, part: null, reference: 'FAC-2026-000012' },
  organizationId: ids.organization,
  amount: xof(120000),
  underReview: true,
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
          data: url.searchParams.get('underReview') === 'true' ? [mismatch] : [payment(), mismatch],
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
    expect(screen.getAllByText('Montant différent').length).toBeGreaterThan(0);
    expect(screen.getAllByText('À examiner').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Voir l’entreprise' })).toHaveAttribute(
      'href',
      `/clients/entreprises/${ids.organization}`,
    );
    expect(await screen.findByText(/Des paiements en ligne sont à examiner/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voir les paiements à examiner' })).toHaveAttribute(
      'href',
      '/finance/paiements?a-examiner=1',
    );
    expect(screen.getAllByText('Réf. trx-4521').length).toBe(2);
    expect(calls.map((call) => call.search).sort()).toEqual(['?limit=1&underReview=true', '?limit=20']);
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
    // Seul lien : le portefeuille du payeur (Finance → Portefeuilles).
    expect(within(table).getAllByRole('link')).toHaveLength(1);
    expect(
      within(table).getByRole('link', { name: 'Portefeuille du payeur : Mission du Nettoyage, acompte' }),
    ).toHaveAttribute('href', `/finance/portefeuilles/particulier/${payment().customerId}`);
    expect(within(table).getByText('Particulier')).toBeInTheDocument();
  });

  it('lie une recharge en écart au portefeuille rechargé', async () => {
    session.set(sessionBody(['finance_officer']));
    const topUp = payment({
      status: 'amount_mismatch',
      underReview: true,
      subject: { type: 'wallet_top_up', id: ids.organization, part: null, reference: null },
      organizationId: ids.organization,
    });
    stubGateway({ [`GET ${PAYMENTS}`]: { status: 200, body: { data: [topUp], nextCursor: null } } });
    render(<PaymentsList />);
    expect(await screen.findByRole('link', { name: 'Recharge du portefeuille' })).toHaveAttribute(
      'href',
      `/finance/portefeuilles/entreprise/${ids.organization}`,
    );
    expect(screen.getByRole('option', { name: 'Recharge du portefeuille' })).toBeInTheDocument();
  });
});

describe('écarts de montant à examiner', () => {
  it('filtre les écarts pas encore traités (?a-examiner=1) et retire le filtre', async () => {
    search = 'a-examiner=1';
    const { calls } = stubGateway({
      [`GET ${PAYMENTS}`]: { status: 200, body: { data: [mismatch], nextCursor: null } },
    });
    render(<PaymentsList />);
    await screen.findByRole('link', { name: 'Facture FAC-2026-000012' });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.search).toBe('?limit=20&underReview=true');
    expect(screen.queryByText(/Des paiements en ligne sont à examiner/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retirer le filtre « À examiner »' }));
    expect(replace).toHaveBeenLastCalledWith('/finance/paiements', { scroll: false });
  });

  it('traite un écart : note obligatoire, clé d’idempotence gardée entre deux essais, accusé de réception', async () => {
    search = 'a-examiner=1';
    const resolved = {
      ...mismatch,
      underReview: false,
      mismatchResolvedAt: '2026-11-05T10:00:00Z',
      mismatchResolvedBy: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d9e99',
      mismatchResolutionNote: 'Remboursé au client.',
    };
    const { calls } = stubGateway({
      [`GET ${PAYMENTS}`]: [
        { status: 200, body: { data: [mismatch], nextCursor: null } },
        { status: 200, body: { data: [], nextCursor: null } },
      ],
      [`POST ${PAYMENTS}/${mismatch.id}/resolve-mismatch`]: [
        {
          status: 503,
          body: {
            error: {
              code: 'GATEWAY_UNAVAILABLE',
              message: 'Service indisponible.',
              details: {},
              correlationId: 'c-test',
            },
          },
        },
        { status: 200, body: resolved },
      ],
    });
    render(<PaymentsList />);
    fireEvent.click(await screen.findByRole('button', { name: 'Traiter l’écart : Facture FAC-2026-000012' }));
    const dialog = screen.getByRole('dialog', { name: 'Traiter l’écart de montant' });
    expect(dialog).toHaveTextContent('Facture FAC-2026-000012');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer le traitement' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Indiquez ce qui a été fait.');
    expect(calls.filter((call) => call.method === 'POST')).toHaveLength(0);

    fireEvent.change(within(dialog).getByLabelText('Ce qui a été fait'), {
      target: { value: '  Remboursé au client.  ' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer le traitement' }));
    expect(
      await within(dialog).findByText(/Service indisponible\. Référence pour le support : c-test\./),
    ).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer le traitement' }));
    expect(await screen.findByText(/Écart traité pour Facture FAC-2026-000012/)).toBeInTheDocument();

    const posts = calls.filter((call) => call.method === 'POST');
    expect(posts).toHaveLength(2);
    expect(posts[0]?.body).toEqual({ note: 'Remboursé au client.' });
    expect(posts[0]?.headers['Idempotency-Key']).toMatch(/^[A-Za-z0-9_-]{8,100}$/);
    expect(posts[1]?.headers['Idempotency-Key']).toBe(posts[0]?.headers['Idempotency-Key']);
    // La liste est relue : l'écart traité quitte le filtre « à examiner ».
    expect(await screen.findByText('Aucun paiement ne correspond à ces filtres.')).toBeInTheDocument();
  });

  it('n’offre pas le traitement d’un écart déjà traité', async () => {
    stubGateway({
      [`GET ${PAYMENTS}`]: {
        status: 200,
        body: {
          data: [
            {
              ...mismatch,
              underReview: false,
              mismatchResolvedAt: '2026-11-05T10:00:00Z',
              mismatchResolutionNote: 'Remboursé.',
            },
          ],
          nextCursor: null,
        },
      },
    });
    render(<PaymentsList />);
    expect(await screen.findByText('Note : Remboursé.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Traiter l’écart/ })).not.toBeInTheDocument();
  });
});
