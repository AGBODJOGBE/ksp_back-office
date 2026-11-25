/**
 * Réponses TEST des dossiers, visites et devis (sous-lot 1b), au format du contrat `ksp-api.v1.yaml`
 * (`CleaningRequestSummary`, `CleaningRequest`, `CleaningVisit`, `CleaningQuote`).
 */
import { ids, simulation, xof } from './fake-gateway.test-utils';

const id = (suffix: string) => `0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d${suffix}`;

export const requestIds = {
  request: id('1001'),
  other: id('1002'),
  customer: id('2001'),
  organization: id('2002'),
  visit: id('3001'),
  agent: id('3101'),
  quote: id('4001'),
  placeRecord: id('5001'),
  fee: id('6001'),
  photo: id('7001'),
};

const typeRef = { id: ids.floor, code: 'sol', name: 'Sol' };

export function requestSummary(overrides: Record<string, unknown> = {}) {
  return {
    id: requestIds.request,
    number: 'DN-000124',
    status: 'visit_to_schedule',
    customerKind: 'individual',
    customerId: requestIds.customer,
    organizationId: null,
    placeTypeName: 'Villa',
    communeKey: 'cotonou',
    communeName: 'Cotonou',
    cleaningTypes: [typeRef],
    nextVisitAt: null,
    createdAt: '2026-11-20T09:00:00Z',
    updatedAt: '2026-11-20T09:00:00Z',
    customerName: 'Afi TEST',
    organizationName: null,
    ...overrides,
  };
}

const placeSummary = {
  placeId: requestIds.placeRecord,
  name: 'Maison de Fidjrossè',
  placeTypeId: ids.place,
  placeTypeName: 'Villa',
  communeKey: 'cotonou',
  communeName: 'Cotonou',
  location: {
    latitude: 6.3654,
    longitude: 2.4183,
    landmark: 'Derrière la pharmacie TEST',
    address: null,
    readableAddress: null,
    accuracyMeters: 12,
  },
};

const schedule = { kind: 'one_off', startTime: '09:00', dates: ['2026-12-05'] };

export function visit(overrides: Record<string, unknown> = {}) {
  return {
    id: requestIds.visit,
    requestId: requestIds.request,
    requestNumber: 'DN-000124',
    status: 'scheduled',
    scheduledAt: '2026-11-28T09:00:00Z',
    durationMinutes: 60,
    travelMinutes: 20,
    agents: [
      {
        agentId: requestIds.agent,
        firstName: 'Koffi',
        lastName: 'TEST',
        photoUrl: null,
        isLead: true,
        confirmation: 'confirmed',
      },
    ],
    arrival: null,
    observedValues: null,
    photos: [],
    completedAt: null,
    missedAt: null,
    cancelledAt: null,
    cancelCause: null,
    note: null,
    ...overrides,
  };
}

export function quote(overrides: Record<string, unknown> = {}) {
  return {
    id: requestIds.quote,
    requestId: requestIds.request,
    requestNumber: 'DN-000124',
    programId: null,
    kind: 'initial',
    version: 1,
    status: 'draft',
    place: placeSummary,
    lines: [
      {
        offerId: ids.offer,
        cleaningTypeId: ids.floor,
        name: 'Sol',
        quantity: 1,
        unit: null,
        unitPrice: xof(29700),
        amount: xof(29700),
        kind: 'offer',
      },
    ],
    adjustments: [
      {
        kind: 'discount',
        percentBps: 2500,
        fixedAmount: null,
        amount: xof(7425),
        reason: 'Client fidèle',
        approvalStatus: 'pending',
        approvedBy: null,
      },
    ],
    sessionPrice: xof(22275),
    sessionsCount: 1,
    sessionStarts: ['2026-12-05T08:00:00Z'],
    total: xof(22275),
    visitFeeDeduction: xof(5000),
    teamSize: 1,
    durationMinutes: 120,
    schedule,
    paymentTerms: 'per_session',
    comparison: null,
    validUntil: null,
    termsVersion: '2026-11',
    pdfDocumentId: null,
    sentAt: null,
    respondedAt: null,
    createdAt: '2026-11-24T10:00:00Z',
    retainedRevision: null,
    ...overrides,
  };
}

export function cleaningRequest(overrides: Record<string, unknown> = {}) {
  const pricing = simulation().pricing;
  return {
    id: requestIds.request,
    number: 'DN-000124',
    status: 'visit_done',
    customerKind: 'individual',
    customerId: requestIds.customer,
    organizationId: null,
    place: placeSummary,
    cleaningTypes: [typeRef],
    declaredValues: { superficie: 150, etat: 'normal', jardin: false },
    freeDescription: null,
    comment: null,
    photos: [
      {
        fileId: requestIds.photo,
        kind: 'request',
        takenAt: '2026-11-20T08:50:00Z',
        url: null,
        urlExpiresAt: null,
      },
    ],
    schedule,
    visitSlots: [{ start: '2026-11-28T08:00:00Z', end: '2026-11-28T10:00:00Z' }],
    declaredPricing: pricing,
    visitFee: {
      id: requestIds.fee,
      rank: 1,
      amount: xof(5000),
      status: 'paid',
      payBefore: '2026-11-23T09:00:00Z',
      paidAt: '2026-11-20T09:30:00Z',
      invoiceId: null,
      refundedAt: null,
    },
    visits: [
      visit({
        status: 'completed',
        completedAt: '2026-11-28T09:50:00Z',
        observedValues: { superficie: 170 },
      }),
    ],
    retained: {
      values: { superficie: 170, etat: 'normal', jardin: false },
      cleaningTypes: [typeRef],
      reasons: [{ parameterCode: 'superficie', cleaningTypeId: null, reason: 'Mesure sur place' }],
      pricing,
      authorId: ids.admin,
      updatedAt: '2026-11-28T11:00:00Z',
      locked: false,
      revision: 1,
      reason: null,
    },
    comparison: null,
    currentQuote: null,
    quoteHistory: [quote()],
    programId: null,
    reactivation: null,
    createdAt: '2026-11-20T09:00:00Z',
    updatedAt: '2026-11-28T11:00:00Z',
    declaredRows: [
      {
        code: 'superficie',
        label: 'Superficie',
        kind: 'number',
        unit: 'm²',
        value: 150,
        display: '150 m²',
        choiceLabel: null,
      },
    ],
    visitFees: [],
    customerName: 'Afi TEST',
    organizationName: null,
    warnings: [],
    ...overrides,
  };
}
