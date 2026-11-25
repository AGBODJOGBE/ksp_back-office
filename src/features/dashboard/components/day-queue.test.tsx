import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { session } from '@/lib/api';
import { errorBody, stubGateway, xof } from '@/lib/api/gateway.test-utils';
import { sessionBody } from '@/lib/api/session.test-utils';
import { DayQueue } from './day-queue';

/*
 * File « À traiter » contre une gateway simulée : réponses au format du contrat `ksp-api.v1.yaml`
 * (données TEST), une route par section.
 */

const ROUTES = {
  payments: '/api/v1/admin/payment/payments',
  organizations: '/api/v1/admin/identity/organizations',
  invoices: '/api/v1/admin/billing/invoices',
  requests: '/api/v1/admin/cleaning/requests',
  unassigned: '/api/v1/admin/cleaning/planning/unassigned',
  agents: '/api/v1/admin/cleaning/agents',
  claims: '/api/v1/admin/cleaning/claims',
  withdrawals: '/api/v1/admin/wallet/withdrawals',
  creditRequests: '/api/v1/admin/wallet/credit-requests',
  myDay: '/api/v1/admin/recovery/my-day',
};

const id = (suffix: string) => `0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d${suffix}`;
const CUSTOMER = id('9e30');

const mismatch = {
  id: id('8002'),
  status: 'amount_mismatch',
  subject: { type: 'billing_invoice', id: id('7001'), part: null, reference: 'FAC-2026-000012' },
  amount: xof(120000),
  customerId: CUSTOMER,
  organizationId: id('0a01'),
  method: 'mobile_money_online',
  provider: 'fedapay',
  providerReference: 'trx-TEST-1',
  checkoutUrl: null,
  failureReason: null,
  createdAt: '2026-11-02T09:00:00Z',
  updatedAt: '2026-11-02T09:05:00Z',
  expiresAt: '2026-11-02T09:30:00Z',
  completedAt: '2026-11-02T09:05:00Z',
  underReview: true,
  customerName: 'Client TEST',
  organizationName: 'SARL TEST Propre',
};

const pendingOrganization = {
  id: id('0a01'),
  legalName: 'SARL TEST Propre',
  address: 'Lot TEST, Cotonou',
  ifu: '3201900000000',
  rccm: null,
  billingEmail: null,
  status: 'pending_review',
  rejectionReason: null,
  suspensionReason: null,
  createdAt: '2026-11-03T10:00:00Z',
  reviewedAt: null,
  createdBy: id('9e60'),
  reviewedBy: null,
  suspendedAt: null,
};

/** Compte entreprise en attente n° `index` (compteur « 20+ »). */
const pendingOrganizationNumber = (index: number) => ({
  ...pendingOrganization,
  id: id(String(9100 + index)),
  legalName: `SARL TEST ${index}`,
});

const overdueInvoice = {
  id: id('7001'),
  number: 'FAC-2026-000012',
  status: 'overdue',
  customerId: CUSTOMER,
  organizationId: id('0a01'),
  source: 'cleaning',
  contractId: id('2001'),
  periodIndex: 1,
  periodStart: '2026-09-30T23:00:00Z',
  periodEnd: '2026-10-31T23:00:00Z',
  lines: [],
  total: xof(160000),
  paid: xof(40000),
  balance: xof(120000),
  issuedAt: '2026-10-31T23:00:00Z',
  dueAt: '2026-11-03T23:00:00Z',
  paidAt: null,
  payments: [],
  organization: { legalName: 'SARL TEST Propre', address: 'Lot TEST', ifu: '3201900000000', rccm: null },
};

const page = (data: unknown[], nextCursor: string | null = null) => ({
  status: 200,
  body: { data, nextCursor },
});
const empty = page([]);

/** Listes du service cleaning : `total` exact (compteur sans « 20+ »). */
const cleaningPage = (data: unknown[], total = data.length) => ({
  status: 200,
  body: { data, nextCursor: null, total },
});
const cleaningEmpty = cleaningPage([]);

/** Réclamation TEST nouvelle, sans réponse depuis plus de 24 h (`CleaningClaim`). */
const openClaim = {
  id: id('8001'),
  sessionId: id('8002'),
  programId: id('8003'),
  customerId: CUSTOMER,
  organizationId: null,
  category: 'damage',
  text: 'Vase cassé.',
  photos: [],
  status: 'open',
  messages: [],
  decision: null,
  openedAt: '2026-11-21T09:00:00Z',
  firstResponseAt: null,
  closedAt: null,
  customerName: 'Afi Mensah',
  organizationName: null,
};

/** Retrait TEST traité par une autre personne, à valider (`Withdrawal`). */
const awaitingWithdrawal = {
  id: id('5002'),
  holder: { type: 'user', id: CUSTOMER },
  amount: xof(25000),
  status: 'awaiting_approval',
  beneficiaryOperator: 'mtn',
  beneficiaryPhoneMasked: '+229 •• •• 45',
  requestedBy: CUSTOMER,
  requestedAt: '2026-11-20T09:00:00Z',
  processedBy: id('9e99'),
  processedAt: '2026-11-20T10:00:00Z',
  processingNote: 'Numéro confirmé.',
  approvedBy: null,
  approvedAt: null,
  rejectedAt: null,
  rejectionReason: null,
  paymentPayoutId: null,
  completedAt: null,
  failedAt: null,
};

/** Demandes de crédit : la liste est dans `items` (`ManualCreditRequestList`). */
const noCreditRequests = { status: 200, body: { items: [], nextCursor: null } };

/** File du chargé du recouvrement (`RecoveryWorkQueue`), une ligne par tâche. */
const myDay = (items: unknown[]) => ({ status: 200, body: { items } });
const recoveryItem = (kind: string, suffix: string) => ({
  kind,
  case: {
    id: id(`ca${suffix}`),
    number: `RC-2026-00${suffix}`,
    kind: 'b2b',
    status: 'active',
    stage: 'amicable',
    creditor: { type: 'organization', id: id('0a01'), displayName: 'SARL TEST Créances' },
    debtorName: `Débiteur TEST ${suffix}`,
    due: xof(450000),
    paid: xof(0),
    score: null,
    assignedAgent: null,
    nextDeadline: null,
    lastActionAt: null,
    createdAt: '2026-11-02T08:00:00Z',
  },
  dueAt: '2026-11-25T09:00:00Z',
  note: kind === 'callback_request' ? 'Rappeler après 17 h.' : null,
});

type Response =
  | ReturnType<typeof page>
  | ReturnType<typeof cleaningPage>
  | typeof noCreditRequests
  | ReturnType<typeof myDay>;
type Handler = Response | Response[] | ((body: unknown, url: URL) => Response);

/** Gateway : une page par route ; `overrides` remplace la réponse d'une route. */
function gateway(overrides: Partial<Record<keyof typeof ROUTES, Handler>> = {}) {
  const full = {
    payments: page([mismatch]),
    organizations: page([pendingOrganization]),
    invoices: page([overdueInvoice]),
    requests: cleaningEmpty,
    unassigned: cleaningEmpty,
    agents: cleaningEmpty,
    // Nouvelles : une réclamation ; en cours : aucune.
    claims: (_body: unknown, url: URL) =>
      url.searchParams.get('status') === 'open' ? cleaningPage([openClaim]) : cleaningEmpty,
    withdrawals: (_body: unknown, url: URL) =>
      url.searchParams.get('status') === 'awaiting_approval' ? page([awaitingWithdrawal]) : empty,
    creditRequests: noCreditRequests,
    myDay: myDay([]),
    ...overrides,
  };
  return stubGateway(
    Object.fromEntries(
      Object.entries(ROUTES).map(([key, path]) => [`GET ${path}`, full[key as keyof typeof ROUTES]]),
    ),
  );
}

const sectionTitles = () =>
  screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent);
const sectionNamed = (name: string) => screen.getByRole('region', { name });

afterEach(() => vi.unstubAllGlobals());

describe('file « À traiter » de Ma journée', () => {
  it('super_admin : sections dans l’ordre de priorité, filtres du contrat, compteurs et actions', async () => {
    session.set(sessionBody(['super_admin']));
    const { calls } = gateway();
    render(<DayQueue />);
    await screen.findByRole('link', { name: 'Valider ou refuser : SARL TEST Propre' });
    await waitFor(() => expect(screen.queryAllByRole('status', { busy: true })).toHaveLength(0));

    // Sections du Nettoyage v2 entre les écarts de paiement et les comptes entreprise.
    expect(sectionTitles()).toEqual([
      'Écarts de paiement',
      'Retraits à valider',
      'Retraits à traiter',
      'Demandes de crédit à valider',
      'Réclamations à traiter',
      'Interventions à affecter',
      'Visites à planifier',
      'Devis à préparer',
      'Candidatures d’agents',
      'Comptes entreprise à valider',
      'Factures impayées',
      'Rappels du recouvrement',
      'Promesses et échéances non tenues',
      'Relances du jour',
      'Contestations et échéanciers à valider',
    ]);

    const search = (path: string) =>
      decodeURIComponent(calls.find((call) => call.path === path)?.search ?? '');
    expect(search(ROUTES.payments)).toBe('?limit=20&underReview=true');
    expect(search(ROUTES.organizations)).toBe('?limit=20&status=pending_review');
    expect(search(ROUTES.invoices)).toBe('?limit=20&status=overdue');
    // Nettoyage : filtres du contrat, deux statuts lus pour les candidatures et les réclamations.
    const cleaning = calls
      .filter((call) => call.path.startsWith('/api/v1/admin/cleaning'))
      .map((call) => decodeURIComponent(call.path + call.search))
      .sort();
    expect(cleaning).toEqual([
      `${ROUTES.agents}?limit=20&status=applicant&sort=-createdAt`,
      `${ROUTES.agents}?limit=20&status=under_review&sort=-createdAt`,
      `${ROUTES.claims}?limit=20&status=in_progress`,
      `${ROUTES.claims}?limit=20&status=open`,
      `${ROUTES.unassigned}?limit=20&sort=urgency`,
      `${ROUTES.requests}?limit=20&status=visit_done`,
      `${ROUTES.requests}?limit=20&status=visit_to_schedule`,
    ]);
    // Recouvrement : une seule lecture de la file du chargé pour ses quatre sections.
    expect(calls.filter((call) => call.path === ROUTES.myDay)).toHaveLength(1);
    expect(calls).toHaveLength(14);
    const wallet = calls
      .filter((call) => call.path.startsWith('/api/v1/admin/wallet'))
      .map((call) => decodeURIComponent(call.path + call.search))
      .sort();
    expect(wallet).toEqual([
      `${ROUTES.creditRequests}?limit=20&status=pending_approval`,
      `${ROUTES.withdrawals}?limit=20&status=awaiting_approval`,
      `${ROUTES.withdrawals}?limit=20&status=requested`,
    ]);
    expect(
      within(sectionNamed('Retraits à valider')).getByRole('button', {
        name: /^Valider et transmettre le retrait de 25\s000/,
      }),
    ).toBeInTheDocument();
    const claims = sectionNamed('Réclamations à traiter');
    expect(
      within(claims).getByRole('link', { name: 'Prendre en charge : Réclamation — Dégât' }),
    ).toHaveAttribute('href', `/nettoyage/reclamations/${openClaim.id}`);
    expect(within(claims).getByText(/Plus de 24 h sans réponse/)).toBeInTheDocument();
    expect(within(claims).getByRole('link', { name: /Voir les réclamations/ })).toHaveAttribute(
      'href',
      '/nettoyage/reclamations?statut=open',
    );

    expect(
      within(sectionNamed('Comptes entreprise à valider')).getByRole('link', {
        name: 'Valider ou refuser : SARL TEST Propre',
      }),
    ).toHaveAttribute('href', `/clients/entreprises/${pendingOrganization.id}`);
    expect(
      within(sectionNamed('Factures impayées')).getByRole('link', {
        name: 'Enregistrer un paiement : Facture FAC-2026-000012',
      }),
    ).toHaveAttribute('href', `/finance/factures/${overdueInvoice.id}`);
    expect(
      within(sectionNamed('Écarts de paiement')).getByRole('button', {
        name: 'Traiter l’écart : Facture FAC-2026-000012',
      }),
    ).toBeInTheDocument();
    expect(within(sectionNamed('Écarts de paiement')).getByText('1')).toBeInTheDocument();
  });

  it('une page pleine et une suite : compteur « 20+ », cinq lignes affichées', async () => {
    session.set(sessionBody(['super_admin']));
    gateway({
      organizations: page(
        Array.from({ length: 20 }, (_, index) => pendingOrganizationNumber(index)),
        id('9199'),
      ),
    });
    render(<DayQueue />);
    const organizations = sectionNamed('Comptes entreprise à valider');
    expect(await within(organizations).findByText('20+')).toBeInTheDocument();
    expect(within(organizations).getByText('20 ou plus à traiter')).toBeInTheDocument();
    expect(within(organizations).getAllByRole('link', { name: /^Valider ou refuser : / })).toHaveLength(5);
  });

  it('finance : écarts de paiement, retraits, demandes de crédit et factures impayées', async () => {
    session.set(sessionBody(['finance_officer']));
    const { calls } = gateway();
    render(<DayQueue />);
    await screen.findByRole('link', { name: 'Enregistrer un paiement : Facture FAC-2026-000012' });
    expect(sectionTitles()).toEqual([
      'Écarts de paiement',
      'Retraits à valider',
      'Retraits à traiter',
      'Demandes de crédit à valider',
      'Factures impayées',
    ]);
    expect(calls.map((call) => call.path).sort()).toEqual([
      ROUTES.invoices,
      ROUTES.payments,
      ROUTES.creditRequests,
      ROUTES.withdrawals,
      ROUTES.withdrawals,
    ]);
  });

  it('agent de terrain du Nettoyage : aucune section (routes du personnel seulement)', () => {
    session.set(sessionBody(['cleaning_agent']));
    const { calls } = gateway();
    render(<DayQueue />);
    expect(screen.getByText(/Aucune file « À traiter » ne correspond à vos rôles/)).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it('support : comptes entreprise à examiner, sans décision', async () => {
    session.set(sessionBody(['support_agent']));
    gateway();
    render(<DayQueue />);
    expect(
      await screen.findByRole('link', { name: 'Examiner la demande : SARL TEST Propre' }),
    ).toBeInTheDocument();
  });

  it('chargé du recouvrement : sa file du jour en quatre sections, une seule lecture', async () => {
    session.set(sessionBody(['recovery_agent']));
    const { calls } = gateway({
      myDay: myDay([
        recoveryItem('broken_promise', '01'),
        recoveryItem('callback_request', '02'),
        recoveryItem('missed_installment', '03'),
      ]),
    });
    render(<DayQueue />);
    const promises = sectionNamed('Promesses et échéances non tenues');
    expect(
      await within(promises).findByRole('link', {
        name: 'Ouvrir le dossier : Dossier RC-2026-0001 — Débiteur TEST 01',
      }),
    ).toHaveAttribute('href', `/recouvrement/dossiers/${id('ca01')}`);
    expect(within(promises).getByText('2')).toBeInTheDocument();
    expect(within(promises).getByText(/Promesse non tenue · Pour le .* · Dû 450\s000/)).toBeInTheDocument();
    const callbacks = sectionNamed('Rappels du recouvrement');
    expect(within(callbacks).getByText(/Demande de rappel · .* · Rappeler après 17 h\./)).toBeInTheDocument();
    expect(within(callbacks).getByRole('link', { name: /Voir les dossiers/ })).toHaveAttribute(
      'href',
      '/recouvrement/dossiers',
    );
    expect(sectionTitles()).toEqual([
      'Rappels du recouvrement',
      'Promesses et échéances non tenues',
      'Relances du jour',
      'Contestations et échéanciers à valider',
    ]);
    expect(calls.map((call) => call.path)).toEqual([ROUTES.myDay]);
  });

  it('un rôle sans section : aucun appel, un message', () => {
    session.set(sessionBody(['print_prepress']));
    const { calls } = gateway();
    render(<DayQueue />);
    expect(screen.getByText(/Aucune file « À traiter » ne correspond à vos rôles/)).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it('tout est vide : sections repliées et « Tout est à jour »', async () => {
    session.set(sessionBody(['super_admin']));
    gateway({
      payments: empty,
      organizations: empty,
      invoices: empty,
      claims: cleaningEmpty,
      withdrawals: empty,
    });
    render(<DayQueue />);
    expect(await screen.findByText('Tout est à jour : rien à traiter pour le moment.')).toBeInTheDocument();
    expect(screen.getAllByText('Rien à traiter')).toHaveLength(15);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('une erreur reste limitée à sa section et se réessaie', async () => {
    session.set(sessionBody(['super_admin']));
    const { calls } = gateway({
      invoices: [
        { status: 503, body: errorBody('GATEWAY_UNAVAILABLE', 'Service de facturation indisponible.') },
        page([overdueInvoice]),
      ] as unknown as ReturnType<typeof page>[],
    });
    render(<DayQueue />);
    const invoices = sectionNamed('Factures impayées');
    expect(await within(invoices).findByRole('alert')).toHaveTextContent(
      'Service de facturation indisponible. Référence pour le support : c-test.',
    );
    // Les autres sections s'affichent.
    expect(
      await screen.findByRole('link', { name: 'Valider ou refuser : SARL TEST Propre' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Tout est à jour : rien à traiter pour le moment.')).not.toBeInTheDocument();

    fireEvent.click(within(invoices).getByRole('button', { name: 'Réessayer' }));
    expect(
      await within(invoices).findByRole('link', { name: /Enregistrer un paiement/ }),
    ).toBeInTheDocument();
    expect(calls.filter((call) => call.path === ROUTES.invoices)).toHaveLength(2);
  });
});
