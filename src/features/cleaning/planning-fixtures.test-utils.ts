/**
 * Réponses TEST du planning et des affectations (sous-lot 1c-2), au format du contrat
 * `ksp-api.v1.yaml` (`CleaningPlanning`, `CleaningPlanningItem`, `CleaningAssignment*`,
 * `CleaningAutoPlanningRun`).
 */
import { ids } from './fake-gateway.test-utils';

const id = (suffix: string) => `0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d${suffix}`;

export const planningIds = {
  session: id('8001'),
  visit: id('8002'),
  koffi: id('8101'),
  awa: id('8102'),
  team: id('8201'),
  assignment: id('8301'),
  proposal: id('8302'),
  run: id('8401'),
};

/** Séance du 25 novembre 2026, 9 h à 12 h au Bénin, deux agents prévus, un seul affecté. */
export function planningItem(overrides: Record<string, unknown> = {}) {
  return {
    kind: 'session',
    id: planningIds.session,
    number: 'PN-000310',
    rank: 3,
    status: 'to_assign',
    start: '2026-11-25T08:00:00Z',
    end: '2026-11-25T11:00:00Z',
    communeKey: 'cotonou',
    communeName: 'Cotonou',
    location: null,
    cleaningTypes: [{ id: ids.floor, code: 'sol', name: 'Sol' }],
    requiredSkills: ['nettoyage_interieur'],
    teamSize: 2,
    agents: [
      {
        agentId: planningIds.koffi,
        firstName: 'Koffi',
        lastName: 'TEST',
        photoUrl: null,
        isLead: true,
        confirmation: 'confirmed',
      },
    ],
    late: false,
    urgent: true,
    suggestedStart: null,
    ...overrides,
  };
}

/** Visite à planifier du dossier DN-000124 (colonne « à affecter »). */
export const unassignedVisit = () =>
  planningItem({
    kind: 'visit',
    id: planningIds.visit,
    number: 'DN-000124',
    rank: null,
    status: 'scheduled',
    start: '2026-11-26T09:00:00Z',
    end: '2026-11-26T10:00:00Z',
    teamSize: 1,
    agents: [],
    urgent: false,
  });

export function planning(overrides: Record<string, unknown> = {}) {
  return {
    from: '2026-11-22T23:00:00Z',
    to: '2026-11-29T23:00:00Z',
    items: [planningItem()],
    loads: [
      {
        agentId: planningIds.koffi,
        firstName: 'Koffi',
        lastName: 'TEST',
        plannedMinutes: 390,
        maxMinutes: 2880,
      },
    ],
    ...overrides,
  };
}

/** Agent actif (`GET /agents?status=active`). */
export const agentOption = (agentId: string, firstName: string, zoneKeys = ['cotonou']) => ({
  id: agentId,
  userId: ids.admin,
  status: 'active',
  firstName,
  lastName: 'TEST',
  zoneKeys,
});

export const team = () => ({
  id: planningIds.team,
  name: 'Équipe TEST',
  leadAgentId: planningIds.koffi,
  members: [
    { agentId: planningIds.koffi, firstName: 'Koffi', lastName: 'TEST', status: 'active' },
    { agentId: planningIds.awa, firstName: 'Awa', lastName: 'TEST', status: 'active' },
  ],
  active: true,
  createdAt: '2026-11-01T08:00:00Z',
});

/** Contrôle d'un agent : réussite, ou échecs donnés (`check`, contournable ou non). */
export function agentCheck(
  agentId: string,
  failures: { check: string; overridable: boolean; overridden?: boolean }[] = [],
) {
  return {
    agentId,
    target: { kind: 'session', id: planningIds.session },
    passed: failures.every((failure) => failure.overridden),
    results: failures.map((failure) => ({
      check: failure.check,
      passed: false,
      overridable: failure.overridable,
      overridden: failure.overridden ?? false,
      missingSkills: failure.check === 'skills' ? ['vitres'] : [],
      conflicts: [],
      unavailabilityId: null,
      unavailabilityStart: null,
      unavailabilityEnd: null,
    })),
  };
}

export function assignment(overrides: Record<string, unknown> = {}) {
  return {
    id: planningIds.assignment,
    target: { kind: 'session', id: planningIds.session },
    agentId: planningIds.awa,
    agentFirstName: 'Awa',
    agentLastName: 'TEST',
    isLead: false,
    source: 'manual',
    status: 'confirmed',
    respondBefore: null,
    overrides: [],
    createdBy: ids.admin,
    createdAt: '2026-11-24T10:00:00Z',
    createdByName: 'Admin TEST',
    ...overrides,
  };
}

export const batch = (assignments: unknown[], overrides: Record<string, unknown> = {}) => ({
  assignments,
  checks: [],
  warnings: [],
  batchId: null,
  skipped: [],
  ...overrides,
});

export const proposal = () =>
  assignment({
    id: planningIds.proposal,
    source: 'auto',
    status: 'proposed',
    createdBy: null,
    createdByName: null,
  });

export const autoRun = (overrides: Record<string, unknown> = {}) => ({
  id: planningIds.run,
  mode: 'proposal',
  from: '2026-11-24T23:00:00Z',
  to: '2026-11-30T23:00:00Z',
  assigned: 0,
  proposed: 1,
  failures: [{ target: { kind: 'visit', id: planningIds.visit }, reason: 'no_candidate' }],
  startedAt: '2026-11-25T07:00:00Z',
  ...overrides,
});
