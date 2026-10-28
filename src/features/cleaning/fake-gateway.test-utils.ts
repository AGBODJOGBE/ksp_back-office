/**
 * Gateway simulée pour les tests du Nettoyage : `fetch` remplacé, réponses au format du contrat
 * `ksp-api.v1.yaml` (`/api/v1/admin/cleaning/*`). Les requêtes reçues sont gardées pour vérifier ce
 * que le front envoie (chemin, requête, corps).
 */

export type FakeResponse = { status: number; body?: unknown };
type Handler = FakeResponse | ((body: unknown, url: URL) => FakeResponse);

export interface GatewayCall {
  method: string;
  path: string;
  search: string;
  body: unknown;
}

export const ids = {
  request: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d1001',
  mission: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d2001',
  intervention: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d3001',
  visit: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d4001',
  quote: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d5001',
  agent: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d0002',
  customer: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d9e30',
  team: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d6001',
};

const xof = (amount: number) => ({ amount, currency: 'XOF' });

export function quoteRequest(overrides: Record<string, unknown> = {}) {
  return {
    id: ids.request,
    status: 'received',
    customerId: ids.customer,
    customerKind: 'individual',
    organizationId: null,
    serviceCode: 'menage_test',
    premisesType: 'apartment',
    quantity: 4,
    options: [],
    commune: 'Cotonou',
    address: 'Rue 12, Akpakpa',
    preferredSlots: [{ start: '2026-11-05T08:00:00Z', end: '2026-11-05T11:00:00Z' }],
    comment: null,
    recurrence: null,
    requestedTeamSize: null,
    daysPerWeek: null,
    recommendedTeamSize: 2,
    estimate: { low: xof(9000), high: xof(11500) },
    visit: null,
    quote: null,
    missionId: null,
    closingReason: null,
    createdAt: '2026-10-28T09:00:00Z',
    updatedAt: '2026-10-28T09:00:00Z',
    ...overrides,
  };
}

export const visit = (overrides: Record<string, unknown> = {}) => ({
  id: ids.visit,
  status: 'scheduled',
  scheduledAt: '2026-10-30T09:00:00Z',
  agentId: ids.agent,
  report: null,
  completedAt: null,
  ...overrides,
});

export function intervention(overrides: Record<string, unknown> = {}) {
  return {
    id: ids.intervention,
    status: 'planned',
    scheduledStart: '2026-11-05T08:00:00Z',
    durationMinutes: 180,
    agents: [{ agentId: ids.agent, displayName: 'Awa B.' }],
    checklist: [
      { code: 'arrival', label: 'Arrivée sur place', done: false },
      { code: 'cleaning_done', label: 'Nettoyage terminé', done: false },
    ],
    incidentNote: null,
    beforePhotoFileIds: [],
    afterPhotoFileIds: [],
    startedAt: null,
    completedAt: null,
    cancellationCause: null,
    ...overrides,
  };
}

export function mission(overrides: Record<string, unknown> = {}) {
  return {
    id: ids.mission,
    requestId: ids.request,
    quoteId: ids.quote,
    customerId: ids.customer,
    status: 'scheduled',
    serviceCode: 'menage_test',
    commune: 'Cotonou',
    address: 'Rue 12, Akpakpa',
    chosenSlot: { start: '2026-11-05T08:00:00Z', end: '2026-11-05T11:00:00Z' },
    recurrence: null,
    plannedInterventions: 1,
    completedInterventions: 0,
    interventions: [intervention()],
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
    updatedAt: '2026-10-28T10:00:00Z',
    ...overrides,
  };
}

export const agent = (overrides: Record<string, unknown> = {}) => ({
  agentId: ids.agent,
  displayName: 'Awa B.',
  active: true,
  unavailabilities: [],
  ...overrides,
});

export const zone = (overrides: Record<string, unknown> = {}) => ({
  code: 'cotonou',
  commune: 'Cotonou',
  active: true,
  updatedBy: null,
  updatedAt: null,
  ...overrides,
});

export function errorBody(code: string, message: string, details: Record<string, unknown> = {}) {
  return { error: { code, message, details, correlationId: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d9e12' } };
}

/** Noms publics des prestations (`GET /cleaning/services`), lus par toutes les fiches. */
export const SERVICES: FakeResponse = {
  status: 200,
  body: {
    data: [
      {
        code: 'menage_test',
        name: 'Prestation de test',
        description: '',
        unit: 'room',
        options: [],
        priced: true,
        minimumPrice: null,
      },
    ],
  },
};

/**
 * Remplace `fetch`. `routes` associe « MÉTHODE /chemin » à une réponse, ou à une liste de réponses
 * données dans l'ordre (la dernière est répétée).
 */
export function stubGateway(routes: Record<string, Handler | Handler[]>) {
  const calls: GatewayCall[] = [];
  const queues = new Map(Object.entries(routes).map(([key, value]) => [key, [value].flat()]));
  const fetchMock = vi.fn(async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const method = init.method ?? 'GET';
    const body = typeof init.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined;
    calls.push({ method, path: url.pathname, search: url.search, body });
    const queue = queues.get(`${method} ${url.pathname}`);
    if (!queue?.length) throw new Error(`Route non simulée : ${method} ${url.pathname}`);
    const handler = (queue.length > 1 ? queue.shift() : queue[0]) as Handler;
    const response = typeof handler === 'function' ? handler(body, url) : handler;
    return new Response(response.body === undefined ? null : JSON.stringify(response.body), {
      status: response.status,
      headers: { 'Content-Type': 'application/json', 'X-Correlation-Id': 'c-test' },
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return { calls, fetchMock };
}
