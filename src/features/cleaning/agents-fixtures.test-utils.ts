/**
 * Réponses TEST des agents, disponibilités et équipes (sous-lot 1c), au format du contrat
 * `ksp-api.v1.yaml` (`CleaningAgent`, `CleaningAvailability`, `CleaningTeam`, `CleaningIdDocument`).
 */
import { ids } from './fake-gateway.test-utils';

const id = (suffix: string) => `0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d${suffix}`;

export const agentIds = {
  agent: id('8001'),
  other: id('8002'),
  user: id('8101'),
  team: id('8201'),
  unavailability: id('8301'),
  extra: id('8302'),
  invitation: id('8401'),
  front: id('8501'),
  back: id('8502'),
};

export function agent(overrides: Record<string, unknown> = {}) {
  return {
    id: agentIds.agent,
    userId: agentIds.user,
    status: 'active',
    firstName: 'Koffi',
    lastName: 'AGBO TEST',
    phone: '+2290197000045',
    photoUrl: null,
    employmentKind: 'employee',
    residenceCommuneKey: 'cotonou',
    zoneKeys: ['cotonou', 'abomey-calavi'],
    skills: [
      { code: 'nettoyage_interieur', name: 'Nettoyage intérieur', validated: true },
      { code: 'vitres_hauteur', name: 'Vitres en hauteur', validated: false },
    ],
    maxHoursPerDay: 8,
    maxHoursPerWeek: 48,
    emergencyContact: { name: 'Afi AGBO TEST', phone: '+2290196000011' },
    mobileMoneyNumber: null,
    hasIdDocument: true,
    stats: {
      sessionsCompleted: 12,
      visitsCompleted: 3,
      hoursThisWeek: 14.5,
      hoursThisMonth: 60,
      ratingAverage: 4.6,
      ratingsCount: 9,
      openClaims: 0,
    },
    createdAt: '2026-11-02T09:00:00Z',
    updatedAt: '2026-11-20T09:00:00Z',
    ...overrides,
  };
}

/** Candidature déposée (statut « applicant »), compétences déclarées non validées. */
export const applicant = (overrides: Record<string, unknown> = {}) =>
  agent({
    id: agentIds.other,
    status: 'applicant',
    firstName: 'Ama',
    lastName: 'DOSSOU TEST',
    phone: '+2290161000022',
    skills: [{ code: 'nettoyage_interieur', name: 'Nettoyage intérieur', validated: false }],
    stats: {
      sessionsCompleted: 0,
      visitsCompleted: 0,
      hoursThisWeek: 0,
      hoursThisMonth: 0,
      ratingAverage: null,
      ratingsCount: 0,
      openClaims: 0,
    },
    ...overrides,
  });

export function unavailability(overrides: Record<string, unknown> = {}) {
  return {
    id: agentIds.unavailability,
    start: '2026-12-01T07:00:00Z',
    end: '2026-12-03T17:00:00Z',
    kind: 'leave',
    note: null,
    forced: false,
    createdBy: ids.admin,
    createdAt: '2026-11-20T09:00:00Z',
    createdByName: 'Admin TEST',
    ...overrides,
  };
}

export function availability(overrides: Record<string, unknown> = {}) {
  return {
    weekly: [
      { weekday: 'mon', ranges: [{ start: '08:00', end: '12:00' }] },
      { weekday: 'tue', ranges: [] },
    ],
    extraAvailabilities: [],
    unavailabilities: [unavailability()],
    maxHoursPerDay: 8,
    maxHoursPerWeek: 48,
    ...overrides,
  };
}

export function team(overrides: Record<string, unknown> = {}) {
  return {
    id: agentIds.team,
    name: 'Équipe Cotonou TEST',
    leadAgentId: agentIds.agent,
    members: [
      { agentId: agentIds.agent, firstName: 'Koffi', lastName: 'AGBO TEST', status: 'active' },
      { agentId: agentIds.other, firstName: 'Ama', lastName: 'DOSSOU TEST', status: 'suspended' },
    ],
    active: true,
    createdAt: '2026-11-10T09:00:00Z',
    ...overrides,
  };
}

const photo = (fileId: string) => ({
  fileId,
  kind: 'request',
  takenAt: '2026-11-02T09:00:00Z',
  url: `https://files.ksp.bj/test/${fileId}`,
  urlExpiresAt: '2026-11-25T10:15:00Z',
});

export const idDocument = () => ({ front: photo(agentIds.front), back: photo(agentIds.back) });
