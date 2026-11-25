/**
 * Réponses TEST des programmes et des séances (sous-lot 1c-3), au format du contrat
 * `ksp-api.v1.yaml` (`CleaningProgram`, `CleaningSession`, `CleaningProgramResumption`).
 */
import { ids, xof } from './fake-gateway.test-utils';

const id = (suffix: string) => `0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d${suffix}`;

export const programIds = {
  program: id('7001'),
  request: id('7002'),
  quote: id('7003'),
  customer: id('7004'),
  session: id('7101'),
  next: id('7102'),
  koffi: id('7201'),
  awa: id('7202'),
  photo: id('7301'),
  other: id('7401'),
};

/** Programme PN-000057 : villa à Cotonou, sol chaque lundi et jeudi, 3 séances sur 24 réalisées. */
export function program(overrides: Record<string, unknown> = {}) {
  return {
    id: programIds.program,
    number: 'PN-000057',
    status: 'in_progress',
    requestId: programIds.request,
    quoteId: programIds.quote,
    customerKind: 'individual',
    customerId: programIds.customer,
    organizationId: null,
    payerKind: 'individual',
    place: {
      placeId: id('7005'),
      name: 'Maison TEST',
      placeTypeId: ids.place,
      placeTypeName: 'Villa',
      communeKey: 'cotonou',
      communeName: 'Cotonou',
      location: null,
    },
    cleaningTypes: [{ id: ids.floor, code: 'sol', name: 'Sol' }],
    schedule: {
      kind: 'weekly',
      startTime: '09:00',
      weekdays: ['mon', 'thu'],
      everyWeeks: 1,
      startDate: '2026-11-02',
      durationWeeks: 12,
      excludeHolidays: true,
    },
    sessionsCount: 24,
    sessionsCompleted: 3,
    sessionPrice: xof(15000),
    total: xof(360000),
    firstSessionAt: '2026-11-02T08:00:00Z',
    lastSessionAt: '2027-01-21T08:00:00Z',
    suspensionCauses: [],
    renewal: null,
    createdAt: '2026-10-28T10:00:00Z',
    pendingCancellation: null,
    customerName: 'Afi TEST',
    organizationName: null,
    ...overrides,
  };
}

/** Programme suspendu par KSP et pour impayés. */
export const suspendedProgram = (overrides: Record<string, unknown> = {}) =>
  program({
    status: 'suspended',
    suspensionCauses: [
      { cause: 'ksp_decision', since: '2026-11-20T09:00:00Z', reason: 'Client injoignable' },
      { cause: 'overdue_sessions', since: '2026-11-19T09:00:00Z', reason: null },
    ],
    ...overrides,
  });

const agent = (agentId: string, firstName: string, isLead: boolean) => ({
  agentId,
  firstName,
  lastName: 'TEST',
  photoUrl: null,
  isLead,
  confirmation: 'confirmed',
});

/** Séance 4 / 24 du 26 novembre 2026, 9 h à 12 h au Bénin, deux agents affectés. */
export function cleaningSession(overrides: Record<string, unknown> = {}) {
  return {
    id: programIds.session,
    programId: programIds.program,
    programNumber: 'PN-000057',
    rank: 4,
    sessionsCount: 24,
    status: 'assigned',
    scheduledStart: '2026-11-26T08:00:00Z',
    scheduledEnd: '2026-11-26T11:00:00Z',
    paymentStatus: 'due',
    price: xof(15000),
    amountDue: xof(15000),
    visitFeeDeduction: null,
    dueBy: '2026-11-27T08:00:00Z',
    agents: [agent(programIds.koffi, 'Koffi', true), agent(programIds.awa, 'Awa', false)],
    arrival: null,
    startedAt: null,
    completedAt: null,
    checklist: [
      { code: 'sols', label: 'Sols lavés', cleaningTypeCode: 'sol', checked: false, checkedAt: null },
    ],
    photos: [
      {
        fileId: programIds.photo,
        kind: 'before',
        takenAt: '2026-11-19T08:10:00Z',
        url: 'https://files.test/avant-1.jpg',
        urlExpiresAt: '2026-11-26T09:00:00Z',
      },
    ],
    incidents: [],
    signed: false,
    rating: null,
    reschedules: [],
    cancellation: null,
    isRedo: false,
    invoiceId: null,
    claimIds: [],
    customerName: 'Afi TEST',
    organizationName: null,
    ...overrides,
  };
}

/** Séance sans montants (compte sans `cleaning.amounts.read`) : `price` et `amountDue` absents. */
export function sessionWithoutAmounts(overrides: Record<string, unknown> = {}) {
  const { price: _price, amountDue: _due, visitFeeDeduction: _fee, ...rest } = cleaningSession(overrides);
  return rest;
}
