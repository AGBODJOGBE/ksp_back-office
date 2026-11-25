import { fireEvent, render, screen, within } from '@testing-library/react';
import { session } from '@/lib/api';
import { errorBody, stubGateway, xof } from '@/lib/api/gateway.test-utils';
import { sessionBody } from '@/lib/api/session.test-utils';
import { commissionInvoice, INVOICES, uuid } from '@/features/recovery/fixtures.test-utils';
import { CommissionInvoiceDetail } from './commission-invoice-detail';
import { CommissionInvoicesList } from './commission-invoices';

let search = '';
const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: replace }),
  usePathname: () => '/recouvrement/factures',
  useSearchParams: () => new URLSearchParams(search),
}));

beforeEach(() => {
  search = '';
  replace.mockReset();
  session.set(sessionBody(['finance_officer']));
});
afterEach(() => vi.unstubAllGlobals());

const ok = (body: unknown) => ({ status: 200, body });
const ID = uuid('f001');

describe('factures de commission', () => {
  it('liste filtrée dans l’adresse : état, mois, créancier ; échec du débit visible', async () => {
    search = `etat=pending_payment&mois=2026-10&creancier=${uuid('0a01')}`;
    const account = commissionInvoice({
      id: uuid('f002'),
      number: 'FCR-2026-000005',
      status: 'paid',
      creditor: { type: 'user', id: uuid('9e30') },
      organization: null,
      debit: null,
    });
    const { calls } = stubGateway({
      [`GET ${INVOICES}`]: ok({ data: [commissionInvoice(), account], nextCursor: null }),
    });
    render(<CommissionInvoicesList />);
    expect(await screen.findByRole('link', { name: 'FCR-2026-000004' })).toHaveAttribute(
      'href',
      `/recouvrement/factures/${ID}`,
    );
    expect(calls[0]?.search).toBe(
      `?limit=20&status=pending_payment&period=2026-10&creditorId=${uuid('0a01')}`,
    );
    expect(screen.getAllByText('octobre 2026')).toHaveLength(2);
    expect(screen.getByText('Débit en échec : Solde insuffisant')).toBeInTheDocument();
    expect(screen.getByText('Compte particulier')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('État'), { target: { value: '' } });
    expect(replace).toHaveBeenCalledWith(`/recouvrement/factures?mois=2026-10&creancier=${uuid('0a01')}`);
  });

  it('valeurs hors contrat de l’adresse ignorées ; liste vide', async () => {
    search = 'etat=inconnu&mois=2026-13';
    const { calls } = stubGateway({ [`GET ${INVOICES}`]: ok({ data: [], nextCursor: null }) });
    render(<CommissionInvoicesList />);
    expect(await screen.findByText('Aucune facture pour ces critères.')).toBeInTheDocument();
    expect(calls[0]?.search).toBe('?limit=20');
  });

  it('fiche : hors taxe, en-tête du créancier, totaux, débit automatique, lignes liées aux dossiers', async () => {
    stubGateway({ [`GET ${INVOICES}/${ID}`]: ok(commissionInvoice()) });
    render(<CommissionInvoiceDetail id={ID} />);
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Facture FCR-2026-000004');
    expect(screen.getByText('Montants hors taxe : aucune ligne de TVA.')).toBeInTheDocument();
    expect(screen.getByText('3201900000000')).toBeInTheDocument();
    const debit = screen.getByRole('region', { name: 'Débit automatique du portefeuille prépayé' });
    expect(within(debit).getByText('Solde insuffisant')).toBeInTheDocument();
    expect(within(debit).getByText(/12\s000/)).toBeInTheDocument();
    const lines = screen.getByRole('table', { name: 'Encaissements facturés, par date' });
    expect(within(lines).getByRole('link', { name: 'Ouvrir le dossier RC-2026-0001' })).toHaveAttribute(
      'href',
      `/recouvrement/dossiers/${uuid('ca01')}`,
    );
    expect(within(lines).getByText('Payé au créancier')).toBeInTheDocument();
    expect(within(lines).getByText('Débitée du portefeuille')).toBeInTheDocument();
  });

  it('facture d’un compte réglée sans débit ; facture introuvable', async () => {
    const paid = commissionInvoice({
      status: 'paid',
      organization: null,
      creditor: { type: 'user', id: uuid('9e30') },
      debit: null,
      balance: xof(0),
      paidAt: '2026-10-31T23:00:00Z',
    });
    stubGateway({ [`GET ${INVOICES}/${ID}`]: ok(paid) });
    const { unmount } = render(<CommissionInvoiceDetail id={ID} />);
    expect(await screen.findByText(/réglée dès son émission/)).toBeInTheDocument();
    expect(screen.getByText(`Compte ${uuid('9e30')}`)).toBeInTheDocument();
    unmount();

    stubGateway({
      [`GET ${INVOICES}/${ID}`]: {
        status: 404,
        body: errorBody('BILLING_INVOICE_NOT_FOUND', 'Facture introuvable.'),
      },
    });
    render(<CommissionInvoiceDetail id={ID} />);
    expect(await screen.findByText(/Élément introuvable/)).toBeInTheDocument();
  });
});
