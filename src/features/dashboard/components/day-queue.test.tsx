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
  missions: '/api/v1/admin/cleaning/missions',
  visits: '/api/v1/admin/cleaning/visits',
  requests: '/api/v1/admin/cleaning/quote-requests',
  organizations: '/api/v1/admin/identity/organizations',
  invoices: '/api/v1/admin/billing/invoices',
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

const passage = {
  id: id('3001'),
  status: 'on_hold',
  scheduledStart: '2026-11-04T08:00:00Z',
  durationMinutes: 180,
  agents: [{ agentId: id('0002'), displayName: 'Agent TEST' }],
  checklist: [],
  incidentNote: 'Accès fermé',
  beforePhotoFileIds: [],
  afterPhotoFileIds: [],
  startedAt: '2026-11-04T08:05:00Z',
  completedAt: null,
  cancellationCause: null,
};

const onHoldMission = {
  id: id('2001'),
  requestId: id('1001'),
  quoteId: id('5001'),
  customerId: CUSTOMER,
  customerName: 'Client TEST',
  organizationName: null,
  status: 'on_hold',
  serviceCode: 'menage_test',
  commune: 'Cotonou',
  address: 'Rue TEST',
  chosenSlot: { start: '2026-11-04T08:00:00Z', end: '2026-11-04T11:00:00Z' },
  recurrence: null,
  plannedInterventions: 1,
  completedInterventions: 0,
  interventions: [passage],
  payment: {
    plan: { option: 'full', timing: 'after', method: 'cash' },
    status: 'due',
    total: xof(10000),
    depositPercent: 30,
    depositAmount: xof(3000),
    paid: xof(0),
    payments: [],
  },
  cancellationReason: null,
  daysPerWeek: null,
  suspension: null,
  createdAt: '2026-10-28T10:00:00Z',
  updatedAt: '2026-11-04T08:30:00Z',
};

const lateVisit = {
  id: id('4001'),
  groupVisitId: null,
  groupId: null,
  status: 'scheduled',
  scheduledAt: '2026-11-04T09:00:00Z',
  completedAt: null,
  report: null,
  agentId: id('0002'),
  agentName: 'Agent TEST',
  customerId: CUSTOMER,
  customerName: 'Client TEST',
  organizationName: null,
  commune: 'Abomey-Calavi',
  address: 'Rue TEST',
  location: null,
  landmark: null,
  geocodedAddress: null,
  placeType: null,
  placeTypeLabel: null,
  requests: [
    {
      requestId: id('1002'),
      visitId: id('4001'),
      serviceCode: 'menage_test',
      serviceName: 'Ménage TEST',
      status: 'visit_scheduled',
    },
  ],
};

const receivedRequest = (suffix: string) => ({
  id: id(suffix),
  status: 'received',
  customerId: CUSTOMER,
  customerKind: 'individual',
  organizationId: null,
  serviceCode: 'menage_test',
  premisesType: 'apartment',
  quantity: 4,
  options: [],
  commune: 'Cotonou',
  address: 'Rue TEST',
  preferredSlots: [],
  comment: null,
  recurrence: null,
  requestedTeamSize: null,
  daysPerWeek: null,
  recommendedTeamSize: 2,
  estimate: null,
  visit: null,
  quote: null,
  missionId: null,
  closingReason: null,
  createdAt: '2026-11-05T07:00:00Z',
  updatedAt: '2026-11-05T07:00:00Z',
  customerName: `Client TEST ${suffix}`,
  organizationName: null,
  serviceName: 'Ménage TEST',
  answers: null,
  selectedOptions: [],
  frequency: null,
  pricingVersion: null,
  calculation: null,
  groupId: null,
  groupSize: 1,
  placeType: null,
  placeTypeLabel: null,
  location: null,
  landmark: null,
  geocodingProvider: null,
  geocodedAddress: null,
});

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

/** Gateway : une page par route ; `overrides` remplace la réponse d'une route. */
function gateway(
  overrides: Partial<Record<keyof typeof ROUTES, ReturnType<typeof page> | ReturnType<typeof page>[]>> = {},
) {
  const full = {
    payments: page([mismatch]),
    missions: page([onHoldMission]),
    visits: page([lateVisit]),
    // 20 demandes et une page suivante : compteur « 20+ », 5 lignes affichées.
    requests: page(
      Array.from({ length: 20 }, (_, index) => receivedRequest(String(1100 + index))),
      id('1199'),
    ),
    organizations: page([pendingOrganization]),
    invoices: page([overdueInvoice]),
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
  it('super_admin : six sections dans l’ordre de priorité, filtres du contrat, compteurs et actions', async () => {
    session.set(sessionBody(['super_admin']));
    const { calls } = gateway();
    render(<DayQueue />);
    await screen.findByText('SARL TEST Propre');
    await waitFor(() => expect(screen.queryAllByRole('status', { busy: true })).toHaveLength(0));

    expect(sectionTitles()).toEqual([
      'Écarts de paiement',
      'Incidents',
      'Comptes rendus à saisir',
      'Demandes à visiter',
      'Comptes entreprise à valider',
      'Factures impayées',
    ]);

    const search = (path: string) =>
      decodeURIComponent(calls.find((call) => call.path === path)?.search ?? '');
    expect(search(ROUTES.payments)).toBe('?limit=20&underReview=true');
    expect(search(ROUTES.missions)).toBe('?limit=20&status=on_hold');
    expect(search(ROUTES.visits)).toMatch(/^\?limit=20&status=scheduled&to=\d{4}-\d{2}-\d{2}T[\d:.]+Z$/);
    expect(search(ROUTES.requests)).toBe('?limit=20&status=received');
    expect(search(ROUTES.organizations)).toBe('?limit=20&status=pending_review');
    expect(search(ROUTES.invoices)).toBe('?limit=20&status=overdue');
    expect(calls).toHaveLength(6);

    const requests = sectionNamed('Demandes à visiter');
    expect(within(requests).getByText('20+')).toBeInTheDocument();
    expect(within(requests).getByText('20 ou plus à traiter')).toBeInTheDocument();
    expect(within(requests).getAllByRole('link', { name: /^Planifier la visite : / })).toHaveLength(5);
    expect(within(requests).getByRole('link', { name: /Voir toutes les demandes reçues/ })).toHaveAttribute(
      'href',
      '/nettoyage?etat=received',
    );

    expect(
      within(sectionNamed('Incidents')).getByRole('link', { name: 'Ouvrir le passage : Client TEST' }),
    ).toHaveAttribute('href', `/nettoyage/missions/${onHoldMission.id}/passages/${passage.id}`);
    expect(
      within(sectionNamed('Comptes rendus à saisir')).getByRole('link', {
        name: 'Saisir le compte rendu : Client TEST',
      }),
    ).toHaveAttribute('href', `/nettoyage/demandes/${id('1002')}`);
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

  it('finance : écarts de paiement et factures impayées seulement', async () => {
    session.set(sessionBody(['finance_officer']));
    const { calls } = gateway();
    render(<DayQueue />);
    await screen.findByRole('link', { name: 'Enregistrer un paiement : Facture FAC-2026-000012' });
    expect(sectionTitles()).toEqual(['Écarts de paiement', 'Factures impayées']);
    expect(calls.map((call) => call.path).sort()).toEqual([ROUTES.invoices, ROUTES.payments]);
  });

  it('agent de terrain : ses incidents et ses comptes rendus, saisis dans la liste des visites', async () => {
    session.set(sessionBody(['cleaning_agent']));
    gateway();
    render(<DayQueue />);
    expect(sectionTitles()).toEqual(['Incidents', 'Comptes rendus à saisir']);
    expect(await screen.findByRole('link', { name: 'Saisir le compte rendu : Client TEST' })).toHaveAttribute(
      'href',
      '/nettoyage/visites?etat=scheduled&periode=passee',
    );
  });

  it('support : comptes entreprise à examiner, sans décision', async () => {
    session.set(sessionBody(['support_agent']));
    gateway();
    render(<DayQueue />);
    expect(
      await screen.findByRole('link', { name: 'Examiner la demande : SARL TEST Propre' }),
    ).toBeInTheDocument();
  });

  it('un rôle sans section : aucun appel, un message', () => {
    session.set(sessionBody(['recovery_agent']));
    const { calls } = gateway();
    render(<DayQueue />);
    expect(screen.getByText(/Aucune file « À traiter » ne correspond à vos rôles/)).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it('tout est vide : sections repliées et « Tout est à jour »', async () => {
    session.set(sessionBody(['super_admin']));
    gateway({
      payments: empty,
      missions: empty,
      visits: empty,
      requests: empty,
      organizations: empty,
      invoices: empty,
    });
    render(<DayQueue />);
    expect(await screen.findByText('Tout est à jour : rien à traiter pour le moment.')).toBeInTheDocument();
    expect(screen.getAllByText('Rien à traiter')).toHaveLength(6);
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
    expect(await screen.findByRole('link', { name: 'Ouvrir le passage : Client TEST' })).toBeInTheDocument();
    expect(screen.queryByText('Tout est à jour : rien à traiter pour le moment.')).not.toBeInTheDocument();

    fireEvent.click(within(invoices).getByRole('button', { name: 'Réessayer' }));
    expect(
      await within(invoices).findByRole('link', { name: /Enregistrer un paiement/ }),
    ).toBeInTheDocument();
    expect(calls.filter((call) => call.path === ROUTES.invoices)).toHaveLength(2);
  });
});
