import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { session } from '@/lib/api';
import { errorBody, stubGateway, xof } from '@/lib/api/gateway.test-utils';
import { sessionBody } from '@/lib/api/session.test-utils';
import { billingAccess } from '@/features/billing/access';
import { BillingSettingsScreen } from './billing-settings';
import { InvoiceDetail } from './invoice-detail';
import { InvoicesList } from './invoices-list';

let search = '';
const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/finance/factures',
  useSearchParams: () => new URLSearchParams(search),
}));

const ids = {
  invoice: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d7001',
  organization: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d0a01',
  mission: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d2001',
  customer: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d9e30',
};
const ADMIN = '/api/v1/admin/billing';
const INVOICE = `${ADMIN}/invoices/${ids.invoice}`;

function invoice(overrides: Record<string, unknown> = {}) {
  return {
    id: ids.invoice,
    number: 'FAC-2026-000012',
    status: 'overdue',
    customerId: ids.customer,
    organizationId: ids.organization,
    source: 'cleaning',
    contractId: ids.mission,
    periodIndex: 2,
    // Novembre 2026 entier : borne de fin = minuit (heure du Bénin) du 1er décembre.
    periodStart: '2026-10-31T23:00:00Z',
    periodEnd: '2026-11-30T23:00:00Z',
    lines: [
      { label: 'Nettoyage des bureaux, novembre', quantity: 1, unitPrice: xof(160000), amount: xof(160000) },
    ],
    total: xof(160000),
    paid: xof(40000),
    balance: xof(120000),
    issuedAt: '2026-11-30T23:00:00Z',
    dueAt: '2026-12-10T23:00:00Z',
    paidAt: null,
    payments: [
      {
        id: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d7101',
        amount: xof(40000),
        method: 'mobile_money_online',
        reference: 'fedapay-123',
        recordedBy: 'system',
        recordedAt: '2026-12-02T10:00:00Z',
      },
    ],
    organization: {
      legalName: 'SARL Bénin Propre',
      address: 'Haie Vive, Cotonou',
      ifu: '3201912345678',
      rccm: null,
    },
    ...overrides,
  };
}

beforeEach(() => {
  search = '';
  replace.mockReset();
  session.set(sessionBody(['finance_officer']));
});

afterEach(() => vi.unstubAllGlobals());

describe('droits de la facturation', () => {
  it('suit les rôles du contrat', () => {
    expect(billingAccess(['cleaning_supervisor'])).toEqual({
      invoices: true,
      settings: false,
      cleaningSettings: false,
    });
    expect(billingAccess(['finance_officer'])).toMatchObject({ invoices: true, settings: true });
    expect(billingAccess(['super_admin'])).toEqual({
      invoices: true,
      settings: true,
      cleaningSettings: true,
    });
    expect(billingAccess(['support_agent']).invoices).toBe(false);
  });
});

describe('liste des factures', () => {
  it('passe l’état, l’entreprise et la mission à la gateway et affiche les factures', async () => {
    search = `etat=overdue&entreprise=${ids.organization}`;
    const { calls } = stubGateway({
      [`GET ${ADMIN}/invoices`]: { status: 200, body: { data: [invoice()], nextCursor: null } },
    });
    render(<InvoicesList />);
    const link = await screen.findByRole('link', { name: 'FAC-2026-000012' });
    expect(link).toHaveAttribute('href', `/finance/factures/${ids.invoice}`);
    expect(screen.getByText('SARL Bénin Propre')).toBeInTheDocument();
    expect(screen.getByText(/du dim\. 1 nov\. 2026 au lun\. 30 nov\. 2026/)).toBeInTheDocument();
    expect(calls[0]?.search).toBe(`?limit=20&status=overdue&organizationId=${ids.organization}`);

    fireEvent.click(screen.getByRole('button', { name: 'Retirer le filtre « Entreprise sélectionnée »' }));
    expect(replace).toHaveBeenCalledWith('/finance/factures?etat=overdue', { scroll: false });
  });

  it('dit quand aucune facture ne correspond, et affiche une erreur avec « Réessayer »', async () => {
    search = 'etat=paid';
    stubGateway({
      [`GET ${ADMIN}/invoices`]: [
        { status: 503, body: errorBody('GATEWAY_UNAVAILABLE', 'Service indisponible.') },
        { status: 200, body: { data: [], nextCursor: null } },
      ],
    });
    render(<InvoicesList />);
    expect(
      await screen.findByText(/Service indisponible\. Référence pour le support : c-test/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByText('Aucune facture ne correspond à ces filtres.')).toBeInTheDocument();
  });
});

describe('fiche d’une facture', () => {
  it('affiche montants, en-tête, lignes et règlements', async () => {
    stubGateway({ [`GET ${INVOICE}`]: { status: 200, body: invoice() } });
    render(<InvoiceDetail id={ids.invoice} />);
    expect(await screen.findByRole('heading', { name: 'Facture FAC-2026-000012' })).toBeInTheDocument();
    expect(screen.getByText('Impayée')).toBeInTheDocument();
    expect(screen.getByText(/Facture impayée : son échéance est passée/)).toBeInTheDocument();
    expect(screen.getByText('SARL Bénin Propre')).toBeInTheDocument();
    expect(screen.getByText('Nettoyage des bureaux, novembre')).toBeInTheDocument();
    expect(screen.getByText('Paiement en ligne (automatique)')).toBeInTheDocument();
    expect(screen.getAllByText(/120\s000/).length).toBeGreaterThan(0);
    // finance_officer : paiements en ligne visibles, mais ni la mission (Nettoyage) ni la fiche d'entreprise.
    expect(screen.getByRole('link', { name: 'Paiements en ligne de cette facture' })).toHaveAttribute(
      'href',
      `/finance/paiements?objet=${ids.invoice}`,
    );
    expect(screen.queryByRole('link', { name: 'Voir la mission' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Voir le compte entreprise' })).not.toBeInTheDocument();
  });

  it('montre la mission et l’entreprise au super administrateur', async () => {
    session.set(sessionBody(['super_admin']));
    stubGateway({ [`GET ${INVOICE}`]: { status: 200, body: invoice() } });
    render(<InvoiceDetail id={ids.invoice} />);
    expect(await screen.findByRole('link', { name: 'Voir la mission' })).toHaveAttribute(
      'href',
      `/nettoyage/missions/${ids.mission}`,
    );
    expect(screen.getByRole('link', { name: 'Voir le compte entreprise' })).toHaveAttribute(
      'href',
      `/clients/entreprises/${ids.organization}`,
    );
  });

  it('enregistre un paiement manuel, avec le refus au-delà du reste dû', async () => {
    const paid = invoice({
      status: 'paid',
      paid: xof(160000),
      balance: xof(0),
      paidAt: '2026-12-03T09:00:00Z',
    });
    const { calls } = stubGateway({
      [`GET ${INVOICE}`]: { status: 200, body: invoice() },
      [`POST ${INVOICE}/payments`]: [
        {
          status: 400,
          body: errorBody('BILLING_PAYMENT_INVALID', 'Ce paiement ne peut pas être enregistré.', {
            reason: 'exceeds_balance',
          }),
        },
        { status: 200, body: paid },
      ],
    });
    render(<InvoiceDetail id={ids.invoice} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Enregistrer un paiement' }));
    const dialog = screen.getByRole('dialog');
    const amount = within(dialog).getByLabelText(/Montant reçu/);
    expect(amount).toHaveValue('120000');
    const send = () =>
      fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer le paiement' }));

    fireEvent.change(amount, { target: { value: '12,5' } });
    send();
    expect(
      await within(dialog).findByText('Saisissez un montant entier supérieur à zéro.'),
    ).toBeInTheDocument();

    fireEvent.change(amount, { target: { value: '130000' } });
    send();
    expect(await within(dialog).findByText(/Montant supérieur au reste dû \(120\s000/)).toBeInTheDocument();

    fireEvent.change(amount, { target: { value: '120000' } });
    fireEvent.change(within(dialog).getByLabelText(/Référence/), { target: { value: 'VIR-2026-1215' } });
    send();
    expect(await screen.findByText(/Paiement de 120\s000.*enregistré\./)).toBeInTheDocument();
    expect(screen.getByText('Payée')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enregistrer un paiement' })).not.toBeInTheDocument();
    const posts = calls.filter((call) => call.method === 'POST');
    expect(posts).toHaveLength(2);
    expect(posts.at(-1)?.body).toEqual({
      amount: 120000,
      method: 'bank_transfer',
      reference: 'VIR-2026-1215',
    });
  });

  it('relit la fiche quand la facture a changé entre-temps', async () => {
    const { calls } = stubGateway({
      [`GET ${INVOICE}`]: [
        { status: 200, body: invoice() },
        { status: 200, body: invoice({ status: 'paid', balance: xof(0), paid: xof(160000) }) },
      ],
      [`POST ${INVOICE}/payments`]: {
        status: 422,
        body: errorBody('BILLING_INVALID_TRANSITION', 'Transition impossible.'),
      },
    });
    render(<InvoiceDetail id={ids.invoice} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Enregistrer un paiement' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer le paiement' }));
    expect(await within(dialog).findByText(/déjà payée ou annulée/)).toBeInTheDocument();
    await waitFor(() => expect(calls.filter((call) => call.method === 'GET')).toHaveLength(2));
  });

  it('n’offre pas de « Réessayer » pour une facture introuvable', async () => {
    stubGateway({
      [`GET ${INVOICE}`]: { status: 404, body: errorBody('BILLING_INVOICE_NOT_FOUND', 'Introuvable.') },
    });
    render(<InvoiceDetail id={ids.invoice} />);
    expect(await screen.findByText('Cette facture est introuvable.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Réessayer' })).not.toBeInTheDocument();
  });
});

describe('réglages de la facturation', () => {
  it('modifie le délai de règlement, borné de 1 à 90 jours', async () => {
    const { calls } = stubGateway({
      [`GET ${ADMIN}/settings`]: {
        status: 200,
        body: { paymentTermDays: 10, updatedBy: null, updatedAt: null },
      },
      [`PUT ${ADMIN}/settings`]: (body) => ({
        status: 200,
        body: { ...(body as object), updatedBy: 'staff', updatedAt: '2026-10-31T10:00:00Z' },
      }),
    });
    render(<BillingSettingsScreen />);
    const input = await screen.findByLabelText(/Délai de règlement \(jours\)/);
    expect(screen.getByText('Valeur par défaut, jamais modifiée.')).toBeInTheDocument();
    fireEvent.change(input, { target: { value: '120' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByText(/entre 1 et 90/)).toBeInTheDocument();
    expect(calls.filter((call) => call.method === 'PUT')).toHaveLength(0);

    fireEvent.change(input, { target: { value: '15' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByText('Réglage enregistré.')).toBeInTheDocument();
    expect(screen.getByText(/Délai actuel : 15 jours/)).toBeInTheDocument();
    expect(calls.find((call) => call.method === 'PUT')?.body).toEqual({ paymentTermDays: 15 });
    // finance_officer : les seuils vivent au Nettoyage, sans lien.
    expect(screen.queryByRole('link', { name: 'Ouvrir les réglages du Nettoyage' })).not.toBeInTheDocument();
  });

  it('renvoie l’admin du Nettoyage vers ses seuils d’impayés', async () => {
    session.set(sessionBody(['cleaning_admin']));
    stubGateway({
      [`GET ${ADMIN}/settings`]: {
        status: 200,
        body: { paymentTermDays: 10, updatedBy: null, updatedAt: null },
      },
    });
    render(<BillingSettingsScreen />);
    expect(await screen.findByRole('link', { name: 'Ouvrir les réglages du Nettoyage' })).toHaveAttribute(
      'href',
      '/nettoyage/catalogue',
    );
  });
});
