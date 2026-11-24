/**
 * Gateway simulée du Nettoyage v2 pour les tests : la passerelle commune (`stubGateway`, requêtes
 * gardées : chemin, requête, corps, en-têtes) et des réponses TEST au format du contrat
 * `ksp-api.v1.yaml` (`/api/v1/admin/cleaning/*`), une fabrique par schéma.
 */
export { errorBody, stubGateway, xof } from '@/lib/api/gateway.test-utils';
import { xof } from '@/lib/api/gateway.test-utils';

export const ADMIN = '/api/v1/admin/cleaning';

const id = (suffix: string) => `0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d${suffix}`;

export const ids = {
  area: id('a001'),
  rooms: id('a002'),
  state: id('a003'),
  garden: id('a004'),
  category: id('b001'),
  place: id('c001'),
  skill: id('d001'),
  floor: id('e001'),
  pack: id('e002'),
  offer: id('f001'),
  tariffPublished: id('f101'),
  tariffDraft: id('f102'),
  zone: id('0a01'),
  holiday: id('0b01'),
  admin: id('9e11'),
};

const UPDATED = { updatedAt: '2026-11-20T09:00:00Z', updatedBy: ids.admin, updatedByName: 'Admin TEST' };

export const page = <T>(data: T[], nextCursor: string | null = null, total = data.length) => ({
  status: 200,
  body: { data, nextCursor, total },
});

export const ok = (body: unknown) => ({ status: 200, body });

export function parameter(overrides: Record<string, unknown> = {}) {
  return {
    id: ids.area,
    code: 'superficie',
    label: 'Superficie',
    kind: 'number',
    unit: 'm²',
    min: 0,
    max: 5000,
    choices: [],
    required: true,
    help: null,
    active: true,
    ...UPDATED,
    ...overrides,
  };
}

export const roomsParameter = () =>
  parameter({ id: ids.rooms, code: 'chambres', label: 'Chambres', unit: 'pièces', max: 50, required: false });

export const stateParameter = () =>
  parameter({
    id: ids.state,
    code: 'etat',
    label: 'État des lieux',
    kind: 'choice',
    unit: null,
    min: null,
    max: null,
    choices: [
      { code: 'normal', label: 'Normal', active: true },
      { code: 'apres_travaux', label: 'Après travaux', active: true },
    ],
  });

export function category(overrides: Record<string, unknown> = {}) {
  return {
    id: ids.category,
    code: 'maison',
    name: 'Maison',
    icon: null,
    order: 1,
    active: true,
    visitFee: xof(5000),
    ...UPDATED,
    ...overrides,
  };
}

export function place(overrides: Record<string, unknown> = {}) {
  return {
    id: ids.place,
    code: 'villa',
    categoryId: ids.category,
    name: 'Villa',
    icon: null,
    photoFileId: null,
    description: null,
    order: 1,
    active: false,
    freeDescription: false,
    parameters: [
      { parameterId: ids.area, code: 'superficie', order: 0 },
      { parameterId: ids.rooms, code: 'chambres', order: 1 },
      { parameterId: ids.state, code: 'etat', order: 2 },
    ],
    areaParameterId: ids.area,
    publiclyVisible: false,
    visibilityReasons: ['inactive', 'no_active_offer'],
    ...UPDATED,
    ...overrides,
  };
}

export function skill(overrides: Record<string, unknown> = {}) {
  return {
    id: ids.skill,
    code: 'nettoyage_interieur',
    name: 'Nettoyage intérieur',
    active: true,
    ...overrides,
  };
}

export function cleaningType(overrides: Record<string, unknown> = {}) {
  return {
    id: ids.floor,
    code: 'sol',
    name: 'Sol',
    description: null,
    icon: null,
    requiredSkillCode: 'nettoyage_interieur',
    referenceDurationMinutes: 120,
    checklist: [{ code: 'aspirer', label: 'Aspirer', order: 0 }],
    isPack: false,
    packItemIds: [],
    active: true,
    ...UPDATED,
    ...overrides,
  };
}

export function offer(overrides: Record<string, unknown> = {}) {
  return {
    id: ids.offer,
    placeTypeId: ids.place,
    cleaningTypeId: ids.floor,
    extraParameters: [],
    teamRule: [
      { fromArea: 0, toArea: 150, agents: 1, durationMinutes: 120 },
      { fromArea: 151, toArea: null, agents: 2, durationMinutes: 180 },
    ],
    currentTariffVersion: 1,
    draftTariffVersion: null,
    active: true,
    order: 0,
    publiclyVisible: false,
    visibilityReasons: ['category_inactive'],
    ...UPDATED,
    ...overrides,
  };
}

export function tariff(overrides: Record<string, unknown> = {}) {
  return {
    id: ids.tariffPublished,
    offerId: ids.offer,
    version: 1,
    status: 'published',
    baseParameterCode: 'superficie',
    brackets: [
      { from: 0, to: 50, mode: 'flat', amount: xof(10000) },
      { from: 51, to: 150, mode: 'per_unit', amount: xof(180) },
    ],
    supplements: [
      {
        parameterCode: 'chambres',
        choiceCode: null,
        mode: 'per_unit',
        amount: xof(1500),
        coefficientBps: null,
        includedUnits: 3,
      },
    ],
    minimum: xof(15000),
    frequencyCoefficients: [{ key: 'weekly', coefficientBps: 9000 }],
    createdAt: '2026-11-19T08:00:00Z',
    createdBy: ids.admin,
    publishedAt: '2026-11-19T10:00:00Z',
    publishedBy: ids.admin,
    packDiscountBps: null,
    createdByName: 'Admin TEST',
    publishedByName: 'Admin TEST',
    ...overrides,
  };
}

export function zone(overrides: Record<string, unknown> = {}) {
  return {
    id: ids.zone,
    communeKey: 'cotonou',
    name: 'Cotonou',
    coefficientBps: 10000,
    visitFeeSurcharge: null,
    planningMode: null,
    active: true,
    openRequests: 0,
    activePrograms: 0,
    ...UPDATED,
    ...overrides,
  };
}

export function settings(overrides: Record<string, unknown> = {}) {
  return {
    maxOpenRequestsPerAccount: 5,
    minVisitLeadHours: 24,
    visitFeePaymentHours: 72,
    visitTargetBusinessHours: 72,
    visitDurationMinutes: 60,
    defaultTravelMinutes: 30,
    defaultVisitFee: xof(5000),
    deductVisitFee: true,
    quoteValidityDays: 15,
    quoteReminderDays: 2,
    maxDiscountWithoutApprovalPercent: 20,
    firstSessionLeadHours: 48,
    programMaxMonths: 24,
    programMaxSessions: 400,
    freeCancellationHours: 24,
    reschedulesPerMonth: 2,
    lateCancellationFeePercent: 50,
    sessionPaymentGraceHours: 24,
    overdueSessionsBeforeSuspension: 1,
    balanceGuarantee: false,
    unpaidInvoicesWarning: 1,
    unpaidInvoicesSuspension: 2,
    defaultPlanningMode: 'proposal',
    planningHorizonDays: 14,
    scoreWeights: { continuity: 40, proximity: 25, balance: 20, rating: 15 },
    assignmentResponseHours: 12,
    defaultMaxHoursPerDay: 8,
    defaultMaxHoursPerWeek: 48,
    maxPhotosPerKind: 10,
    claimWindowHours: 48,
    retentionMonths: 12,
    commonChecklist: [{ code: 'aerer', label: 'Aérer les pièces', order: 0 }],
    arrivalAlertMeters: 300,
    arrivalMaxAdvanceMinutes: 30,
    customerWaitMinutes: 30,
    ...UPDATED,
    ...overrides,
  };
}

/** `CleaningSimulation` TEST : une offre chiffrée avec son détail. */
export function simulation(overrides: Record<string, unknown> = {}) {
  return {
    pricing: {
      communeKey: 'cotonou',
      communeCoefficientBps: 11000,
      offers: [
        {
          offerId: ids.offer,
          cleaningTypeId: ids.floor,
          cleaningTypeCode: 'sol',
          name: 'Sol',
          tariffVersion: 2,
          status: 'priced',
          minimumApplied: false,
          price: xof(27000),
          lines: [
            {
              kind: 'bracket',
              label: 'Sol, tranche 51 à 150 m²',
              parameterCode: 'superficie',
              quantity: 150,
              unitAmount: xof(180),
              coefficientBps: null,
              amount: xof(27000),
            },
          ],
          onQuoteReason: null,
          tariffStatus: 'draft',
        },
      ],
      complete: true,
      packDiscount: null,
      sessionPrice: xof(29700),
      range: { low: xof(26500), high: xof(34500) },
      sessionsCount: null,
      programTotal: null,
      frequencyDiscount: null,
      visitFee: xof(5000),
      calculatedAt: '2026-11-24T10:00:00Z',
      pricedSubtotal: xof(27000),
      status: 'priced',
      programRange: null,
      teamSize: 1,
      durationMinutes: 120,
    },
    schedule: null,
    disclaimer: 'Estimation non contractuelle, confirmée après la visite des lieux',
    covered: true,
    communeApplied: true,
    notices: [],
    usesDrafts: true,
    ...overrides,
  };
}
