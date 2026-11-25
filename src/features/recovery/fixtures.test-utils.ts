import { xof } from '@/lib/api/gateway.test-utils';

/*
 * Réponses TEST au format du contrat `ksp-api.v1.yaml` (routes `/api/v1/admin/recovery/*` et
 * `/api/v1/admin/billing/commission-invoices*`) : aucune donnée réelle.
 */

export const ADMIN = '/api/v1/admin/recovery';
export const INVOICES = '/api/v1/admin/billing/commission-invoices';

export const uuid = (suffix: string) => `0192f1c4-7a2b-7c3d-8e4f-${suffix.padStart(12, '0')}`;
export const ME = uuid('9e01');
export const OTHER = uuid('9e02');

export const staff = (userId: string, displayName: string | null) => ({ type: 'staff', userId, displayName });

export const caseSummary = (suffix: string, overrides: Record<string, unknown> = {}) => ({
  id: uuid(`ca${suffix}`),
  number: `RC-2026-00${suffix}`,
  kind: 'b2b',
  status: 'active',
  stage: 'amicable',
  creditor: { type: 'organization', id: uuid('0a01'), displayName: 'SARL TEST Créances' },
  debtorName: `Débiteur TEST ${suffix}`,
  due: xof(450000),
  paid: xof(50000),
  score: 62,
  assignedAgent: staff(ME, 'Chargé TEST'),
  nextDeadline: { kind: 'promise', dueAt: '2026-11-25T09:00:00Z' },
  lastActionAt: '2026-11-24T10:00:00Z',
  createdAt: '2026-11-02T08:00:00Z',
  ...overrides,
});

export const workItem = (kind: string, suffix: string, note: string | null = null) => ({
  kind,
  case: caseSummary(suffix),
  dueAt: '2026-11-25T09:00:00Z',
  note,
});

export const overview = {
  casesByStage: [
    { stage: 'notice', count: 4 },
    { stage: 'amicable', count: 7 },
  ],
  casesByKind: [
    { stage: 'b2b', count: 8 },
    { stage: 'rent', count: 3 },
  ],
  entrusted: xof(12500000),
  recovered: xof(3100000),
  recoveryRateBps: 2480,
  recoveryRateByStageBps: [
    { stage: 'amicable', count: 2100 },
    { stage: 'formal_notice', count: 3500 },
  ],
  agents: [{ agent: staff(ME, 'Chargé TEST'), openCases: 9, recovered: xof(2000000), recoveryRateBps: 2600 }],
  installmentsDueToday: 3,
  promisesToCheck: 2,
  idleCases: 5,
  prescriptionsNear: 1,
  reviewQueue: 6,
  offlinePaymentsToApprove: 2,
};

/** Règle TEST (`RecoveryPricingRule`), commission par tranches publiée par défaut. */
export const rule = (overrides: Record<string, unknown> = {}) => ({
  id: uuid('a001'),
  object: 'recovery_commission',
  mode: 'tiered',
  fixedAmount: null,
  rateBps: null,
  // Tranches telles que la gateway les renvoie : le champ inutile vaut 0 XOF.
  tiers: [
    { upTo: xof(1000000), rateBps: 1500, fixedAmount: xof(0) },
    { upTo: null, rateBps: 1000, fixedAmount: xof(0) },
  ],
  stageRates: [],
  minimum: xof(5000),
  maximum: null,
  target: { offer: 'b2b', communeKey: null, creditor: null },
  validFrom: '2026-12-01T00:00:00Z',
  validUntil: null,
  version: 1,
  status: 'published',
  label: 'Commission B2B par tranches',
  createdBy: staff(OTHER, 'Responsable TEST'),
  approvedBy: null,
  publishedAt: '2026-11-20T10:00:00Z',
  previousVersionId: null,
  ...overrides,
});

export const draftRule = (overrides: Record<string, unknown> = {}) =>
  rule({ id: uuid('a002'), status: 'draft', publishedAt: null, label: 'Brouillon TEST', ...overrides });

export const simulation = {
  amount: xof(160000),
  ruleId: uuid('a002'),
  ruleVersion: 1,
  lines: [
    { label: 'Commission à l’amiable', base: xof(1100000), rateBps: null, amount: xof(160000) },
    { label: 'Reversé au créancier', base: xof(1100000), rateBps: null, amount: xof(940000) },
  ],
  boundApplied: null,
};

const scale = {
  acceptsPaymentPlan: true,
  maxDurationMonths: 6,
  minFirstPaymentBps: 1000,
  firstPaymentWithinDays: 7,
  minInstallment: xof(10000),
  maxDiscountBps: 500,
};

export const settings = {
  minimumCaseAmount: xof(50000),
  feePaymentDays: 7,
  reviewBusinessDays: 2,
  infoCompletionDays: 10,
  noticeResponseDays: 8,
  installmentGraceDays: 3,
  missedInstallmentsBeforeAmicable: 2,
  amicableDurationDays: 30,
  formalNoticeDays: 15,
  creditorApprovalDays: 5,
  disputeAnswerDays: 10,
  prescriptionAlertDays: 90,
  contactWindow: { start: '08:00', end: '19:00', days: [1, 2, 3, 4, 5] },
  debtorLinkDays: 30,
  remittanceBusinessDays: 5,
  closedCaseRetentionYears: 5,
  defaultB2bScale: scale,
  defaultB2cScale: scale,
  defaultRentScale: scale,
  scoreWeights: {
    debtAge: 20,
    writtenAcknowledgment: 20,
    evidenceQuality: 20,
    amount: 10,
    validContacts: 20,
    partialPayments: 10,
  },
  planCreditorApprovalDays: 3,
  partnerSilenceAlertDays: 10,
  debtorSessionMinutes: 30,
  unrecoverableAfterMonths: 12,
};

export const settingsView = {
  settings,
  updatedAt: '2026-11-20T10:00:00Z',
  updatedBy: staff(OTHER, 'Responsable TEST'),
};

export const commissionInvoice = (overrides: Record<string, unknown> = {}) => ({
  id: uuid('f001'),
  number: 'FCR-2026-000004',
  status: 'pending_payment',
  creditor: { type: 'organization', id: uuid('0a01') },
  period: '2026-10',
  periodStart: '2026-09-30T23:00:00Z',
  periodEnd: '2026-10-31T23:00:00Z',
  lines: [
    {
      caseId: uuid('ca01'),
      caseNumber: 'RC-2026-0001',
      collectionId: uuid('c001'),
      receivedAt: '2026-10-12T09:00:00Z',
      receivedOn: '2026-10-12',
      source: 'direct_to_creditor',
      gross: xof(200000),
      commission: xof(30000),
      settlement: 'invoiced',
    },
  ],
  totalCollected: xof(200000),
  commissionDeducted: xof(0),
  commissionInvoiced: xof(30000),
  commissionTotal: xof(30000),
  balance: xof(30000),
  amountsExcludingTax: true,
  issuedAt: '2026-10-31T23:00:00Z',
  paidAt: null,
  walletTransactionId: null,
  debit: {
    attempts: 2,
    lastAttemptAt: '2026-11-02T08:00:00Z',
    nextAttemptAt: '2026-11-03T08:00:00Z',
    lastFailure: 'insufficient_funds',
    missing: xof(12000),
  },
  organization: {
    legalName: 'SARL TEST Créances',
    address: 'Lot TEST, Cotonou',
    ifu: '3201900000000',
    rccm: null,
  },
  ...overrides,
});
