import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { session } from '@/lib/api';
import { errorBody, stubGateway, xof } from '@/lib/api/gateway.test-utils';
import { sessionBody } from '@/lib/api/session.test-utils';
import { creditableAmount, splitPreview, validateCreditNote } from '@/features/billing/credit-note-form';
import type { Invoice } from '@/features/billing/schemas';
import { CreditNotesList } from './credit-notes-list';
import { InvoiceDetail } from './invoice-detail';

let search = '';
const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/finance/avoirs',
  useSearchParams: () => new URLSearchParams(search),
}));

const id = (suffix: string) => `0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d${suffix}`;
const ADMIN = '/api/v1/admin/billing';
const INVOICE = `${ADMIN}/invoices/${id('7001')}`;

function note(overrides: Record<string, unknown> = {}) {
  return {
    id: id('7a01'),
    number: 'AV-2026-000001',
    invoiceId: id('7001'),
    invoiceNumber: 'FAC-2026-000012',
    customerId: id('9e30'),
    organizationId: id('0a01'),
    lines: [{ label: 'Séance facturée deux fois', quantity: 1, unitPrice: xof(10000), amount: xof(10000) }],
    total: xof(10000),
    reason: 'Doublon',
    issuedBy: 'service:cleaning',
    issuedAt: '2026-12-01T10:00:00Z',
    appliedToBalance: xof(10000),
    creditedToWallet: xof(0),
    ...overrides,
  };
}

function invoice(overrides: Record<string, unknown> = {}) {
  return {
    id: id('7001'),
    number: 'FAC-2026-000012',
    status: 'overdue',
    customerId: id('9e30'),
    organizationId: id('0a01'),
    source: 'cleaning',
    contractId: id('2001'),
    periodIndex: 2,
    periodStart: '2026-10-31T23:00:00Z',
    periodEnd: '2026-11-30T23:00:00Z',
    lines: [{ label: 'Nettoyage, novembre', quantity: 1, unitPrice: xof(160000), amount: xof(160000) }],
    total: xof(160000),
    paid: xof(40000),
    balance: xof(110000),
    issuedAt: '2026-11-30T23:00:00Z',
    dueAt: '2026-12-10T23:00:00Z',
    paidAt: null,
    payments: [],
    organization: null,
    creditNotes: [note()],
    ...overrides,
  };
}

beforeEach(() => {
  search = '';
  replace.mockReset();
  session.set(sessionBody(['finance_officer']));
});

afterEach(() => vi.unstubAllGlobals());

describe('règles du formulaire d’avoir', () => {
  const draft = (amount: string, label = 'Erreur', reason = 'Motif') => ({
    lines: [{ key: 0, label, amount }],
    reason,
  });

  it('reste possible = total de la facture moins les avoirs déjà émis ; imputation prévue', () => {
    expect(creditableAmount(invoice() as unknown as Invoice)).toBe(150000);
    expect(creditableAmount(invoice({ creditNotes: undefined }) as unknown as Invoice)).toBe(160000);
    expect(splitPreview(30000, 110000)).toEqual({ applied: 30000, credited: 0 });
    expect(splitPreview(30000, 0)).toEqual({ applied: 0, credited: 30000 });
    expect(splitPreview(30000, 10000)).toEqual({ applied: 10000, credited: 20000 });
  });

  it('refuse un montant non entier, un libellé ou un motif vide, un total au-delà du reste', () => {
    expect(validateCreditNote(draft('12,5'), 1000).errors.lines[0]?.amount).toMatch(/nombre entier/);
    expect(validateCreditNote(draft('0'), 1000).request).toBeNull();
    expect(validateCreditNote(draft('100', ' '), 1000).errors.lines[0]?.label).toBe(
      'Indiquez le libellé de chaque ligne.',
    );
    expect(validateCreditNote(draft('100', 'Erreur', ''), 1000).errors.reason).toBe('Indiquez le motif.');
    expect(validateCreditNote(draft('1 001'), 1000).errors.total).toMatch(/^Le total dépasse/);
    expect(validateCreditNote(draft('1 000'), 1000).request).toEqual({
      lines: [{ label: 'Erreur', amount: 1000 }],
      reason: 'Motif',
      total: 1000,
    });
  });
});

describe('avoirs sur la fiche d’une facture', () => {
  it('montre les avoirs émis ; seule la finance peut en émettre', async () => {
    stubGateway({ [`GET ${INVOICE}`]: { status: 200, body: invoice() } });
    const { unmount } = render(<InvoiceDetail id={id('7001')} />);
    const panel = await screen.findByRole('region', { name: 'Avoirs' });
    expect(within(panel).getByText('AV-2026-000001')).toBeInTheDocument();
    expect(within(panel).getByText('Par : Nettoyage (automatique)')).toBeInTheDocument();
    expect(within(panel).getByText(/Encore possible en avoir : 150\s000/)).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Émettre un avoir' })).toBeInTheDocument();
    unmount();

    session.set(sessionBody(['cleaning_supervisor']));
    render(<InvoiceDetail id={id('7001')} />);
    const readOnly = await screen.findByRole('region', { name: 'Avoirs' });
    expect(within(readOnly).queryByRole('button', { name: 'Émettre un avoir' })).not.toBeInTheDocument();
  });

  it('facture annulée : aucun avoir possible', async () => {
    stubGateway({ [`GET ${INVOICE}`]: { status: 200, body: invoice({ status: 'cancelled' }) } });
    render(<InvoiceDetail id={id('7001')} />);
    const panel = await screen.findByRole('region', { name: 'Avoirs' });
    expect(within(panel).getByText('Facture annulée : aucun avoir possible.')).toBeInTheDocument();
    expect(within(panel).queryByRole('button', { name: 'Émettre un avoir' })).not.toBeInTheDocument();
  });

  it('émet un avoir confirmé, avec la même clé à chaque essai, et met la fiche à jour', async () => {
    const issued = note({ id: id('7a02'), number: 'AV-2026-000002', total: xof(30000), issuedBy: 'x' });
    const { calls } = stubGateway({
      [`GET ${INVOICE}`]: { status: 200, body: invoice() },
      [`POST ${INVOICE}/credit-notes`]: [
        { status: 503, body: errorBody('GATEWAY_UNAVAILABLE', 'Service indisponible.') },
        {
          status: 201,
          body: {
            creditNote: issued,
            invoice: invoice({ balance: xof(80000), creditNotes: [note(), issued] }),
            created: true,
          },
        },
      ],
    });
    render(<InvoiceDetail id={id('7001')} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Émettre un avoir' }));
    const dialog = screen.getByRole('dialog', { name: 'Émettre un avoir' });
    expect(within(dialog).getByText(/Montant total au plus 150\s000/)).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText('Montant (FCFA)'), { target: { value: '200000' } });
    fireEvent.change(within(dialog).getByLabelText('Libellé'), {
      target: { value: 'Séance du 12 novembre' },
    });
    fireEvent.change(within(dialog).getByLabelText('Motif'), {
      target: { value: 'Doublon sur la facture.' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Vérifier' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent(/Le total dépasse/);

    fireEvent.change(within(dialog).getByLabelText('Montant (FCFA)'), { target: { value: '30 000' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Vérifier' }));
    expect(within(dialog).getByRole('heading', { name: 'Confirmer l’avoir' })).toBeInTheDocument();
    expect(
      within(dialog).getByText(/Imputé sur le reste dû : 30\s000.*Crédité au portefeuille du client : 0/),
    ).toBeInTheDocument();
    expect(calls.filter((call) => call.method === 'POST')).toHaveLength(0);

    fireEvent.click(within(dialog).getByRole('button', { name: /^Émettre l’avoir de 30\s000/ }));
    expect(await within(dialog).findByText(/Service indisponible/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: /^Émettre l’avoir de 30\s000/ }));
    expect(await screen.findByText(/Avoir AV-2026-000002 de 30\s000 .* émis\./)).toBeInTheDocument();

    const posts = calls.filter((call) => call.method === 'POST');
    expect(posts[0]?.body).toEqual({
      lines: [{ label: 'Séance du 12 novembre', amount: { amount: 30000, currency: 'XOF' } }],
      reason: 'Doublon sur la facture.',
    });
    expect(posts[0]?.headers['Idempotency-Key']).toMatch(/^[A-Za-z0-9_-]{8,100}$/);
    expect(posts[1]?.headers['Idempotency-Key']).toBe(posts[0]?.headers['Idempotency-Key']);
    expect(screen.getByText('AV-2026-000002')).toBeInTheDocument();
  });

  it('refus « avoirs au-delà du total » : message gardé sur la fiche, facture relue', async () => {
    const { calls } = stubGateway({
      [`GET ${INVOICE}`]: { status: 200, body: invoice() },
      [`POST ${INVOICE}/credit-notes`]: {
        status: 422,
        body: errorBody('BILLING_CREDIT_NOTE_EXCEEDS_INVOICE', 'Dépasse le total.'),
      },
    });
    render(<InvoiceDetail id={id('7001')} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Émettre un avoir' }));
    const dialog = screen.getByRole('dialog', { name: 'Émettre un avoir' });
    fireEvent.change(within(dialog).getByLabelText('Montant (FCFA)'), { target: { value: '5000' } });
    fireEvent.change(within(dialog).getByLabelText('Libellé'), { target: { value: 'Correction' } });
    fireEvent.change(within(dialog).getByLabelText('Motif'), { target: { value: 'Erreur de tarif.' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Vérifier' }));
    fireEvent.click(within(dialog).getByRole('button', { name: /^Émettre l’avoir/ }));
    expect(
      await screen.findAllByText(/Le total des avoirs dépasserait le total de la facture/),
    ).not.toHaveLength(0);
    await waitFor(() => expect(calls.filter((call) => call.method === 'GET')).toHaveLength(2));
  });
});

describe('liste des avoirs', () => {
  it('lit les filtres de l’adresse, relie la facture, et se retire filtre par filtre', async () => {
    search = `facture=${id('7001')}`;
    const { calls } = stubGateway({
      [`GET ${ADMIN}/credit-notes`]: { status: 200, body: { data: [note()], nextCursor: null } },
    });
    render(<CreditNotesList />);
    expect(await screen.findByRole('link', { name: 'Facture FAC-2026-000012' })).toHaveAttribute(
      'href',
      `/finance/factures/${id('7001')}`,
    );
    expect(decodeURIComponent(calls[0]?.search ?? '')).toBe(`?limit=20&invoiceId=${id('7001')}`);
    fireEvent.click(screen.getByRole('button', { name: 'Retirer le filtre « Facture sélectionnée »' }));
    expect(replace).toHaveBeenCalledWith('/finance/avoirs', { scroll: false });
  });

  it('hors finance : message, aucun appel', () => {
    session.set(sessionBody(['cleaning_supervisor']));
    const { calls } = stubGateway({});
    render(<CreditNotesList />);
    expect(screen.getByText('Les avoirs sont réservés à la finance.')).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });
});
