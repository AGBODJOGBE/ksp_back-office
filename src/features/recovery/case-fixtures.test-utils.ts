import { xof } from '@/lib/api/gateway.test-utils';
import { caseSummary, OTHER, staff, uuid } from './fixtures.test-utils';

/*
 * Dossier, journal et paiements hors ligne TEST au format du contrat `ksp-api.v1.yaml`
 * (`RecoveryAdminCase`, `RecoveryJournalPage`, `RecoveryOfflinePaymentPage`) : aucune donnée réelle.
 */

export const CASE_ID = uuid('ca01');
export const DEBTOR_ID = uuid('d001');

const scale = {
  acceptsPaymentPlan: true,
  maxDurationMonths: 6,
  minFirstPaymentBps: 1000,
  firstPaymentWithinDays: 7,
  minInstallment: xof(10000),
  maxDiscountBps: 2000,
};

export const plan = (overrides: Record<string, unknown> = {}) => ({
  id: uuid('b001'),
  status: 'proposed',
  terms: { firstAmount: xof(100000), firstDueDate: '2026-12-01', rhythm: 'monthly', installmentsCount: 2 },
  total: xof(400000),
  installments: [
    {
      id: uuid('b101'),
      rank: 1,
      dueDate: '2026-12-01',
      amount: xof(100000),
      paidAmount: xof(0),
      status: 'upcoming',
      paidAt: null,
    },
    {
      id: uuid('b102'),
      rank: 2,
      dueDate: '2027-01-01',
      amount: xof(150000),
      paidAmount: xof(0),
      status: 'upcoming',
      paidAt: null,
    },
    {
      id: uuid('b103'),
      rank: 3,
      dueDate: '2027-02-01',
      amount: xof(150000),
      paidAmount: xof(0),
      status: 'upcoming',
      paidAt: null,
    },
  ],
  withinScale: true,
  violations: [],
  proposedBy: 'agent',
  renegotiation: false,
  documentId: null,
  signedAt: null,
  missedCount: 0,
  createdAt: '2026-11-24T10:00:00Z',
  ...overrides,
});

/** `RecoveryCase` TEST : dossier actif à l'étape de notification, champs non lus compris. */
export const recoveryCase = (overrides: Record<string, unknown> = {}) => ({
  id: CASE_ID,
  number: 'RC-2026-0001',
  kind: 'b2b',
  nature: 'unpaid_invoice',
  status: 'active',
  stage: 'notice',
  creditor: { type: 'organization', id: uuid('0a01'), displayName: 'SARL TEST Créances' },
  debtors: [
    {
      id: DEBTOR_ID,
      kind: 'company',
      role: 'main',
      displayName: 'Débiteur TEST SARL',
      firstNames: null,
      lastName: null,
      legalName: 'Débiteur TEST SARL',
      ifu: null,
      rccm: null,
      representativeName: 'Représentant TEST',
      phones: ['+2290197000099'],
      emails: [],
      address: 'Lot TEST, Cotonou',
      communeKey: 'cotonou',
    },
  ],
  claims: [
    {
      id: uuid('c101'),
      reference: 'FAC-TEST-1',
      amount: xof(400000),
      dueDate: '2026-06-30',
      description: null,
    },
  ],
  priorEffort: { remindersSent: 1 },
  planScale: scale,
  amounts: {
    principal: xof(400000),
    interests: xof(40000),
    costs: xof(10000),
    paid: xof(50000),
    waived: xof(0),
    due: xof(400000),
    overpaid: xof(0),
  },
  prescriptionDate: '2031-06-30',
  score: 62,
  assignedAgent: staff(OTHER, 'Chargé TEST'),
  partnerAssignment: null,
  mandate: null,
  fee: null,
  pricing: {
    feeRuleId: uuid('a003'),
    feeRuleVersion: 1,
    commissionRuleId: uuid('a001'),
    commissionRuleVersion: 1,
    commissionSummary: '10 % à l’amiable',
  },
  currentPlan: null,
  promises: [],
  collections: [],
  documents: [],
  disputes: [],
  notices: [],
  feeQuotes: [],
  provisions: [],
  stageHistory: [
    {
      fromStage: null,
      toStage: 'notice',
      at: '2026-11-03T08:00:00Z',
      by: staff(OTHER, 'Superviseur TEST'),
      reason: null,
      skipReason: null,
    },
  ],
  nextDeadline: { kind: 'notice_response', dueAt: '2026-11-28T17:00:00Z' },
  reviewNote: null,
  rejectionReason: null,
  closure: null,
  source: 'form',
  createdAt: '2026-11-02T08:00:00Z',
  submittedAt: '2026-11-02T09:00:00Z',
  acceptedAt: '2026-11-03T08:00:00Z',
  updatedAt: '2026-11-24T10:00:00Z',
  ...overrides,
});

export const adminCase = (overrides: Record<string, unknown> = {}) => ({
  case: recoveryCase(overrides),
  scoreFactors: [{ criterion: 'Ancienneté de la dette', value: '5 mois', points: 15 }],
  injunctionEligible: true,
});

export const journalEntry = (suffix: string, overrides: Record<string, unknown> = {}) => ({
  id: uuid(`e${suffix}`),
  kind: 'contact',
  channel: 'phone',
  direction: 'outbound',
  outcome: 'no_answer',
  deliveryStatus: null,
  summary: `Appel TEST ${suffix}`,
  amount: null,
  author: staff(OTHER, 'Chargé TEST'),
  internal: false,
  documentId: null,
  fileId: null,
  occurredAt: '2026-11-24T10:00:00Z',
  ...overrides,
});

export const journalPage = (entries: unknown[], nextCursor: string | null = null) => ({
  entries,
  nextCursor,
});

export const casePage = (cases: unknown[], total = cases.length, nextCursor: string | null = null) => ({
  cases,
  nextCursor,
  total,
});

export const offlinePayment = (overrides: Record<string, unknown> = {}) => ({
  id: uuid('0f01'),
  caseId: CASE_ID,
  caseNumber: 'RC-2026-0001',
  source: 'cash',
  amount: xof(75000),
  receivedOn: '2026-11-24',
  reference: 'REC-TEST-1',
  proofFileId: null,
  status: 'pending_approval',
  recordedBy: staff(OTHER, 'Finance TEST'),
  approvedBy: null,
  rejectionReason: null,
  collectionId: null,
  createdAt: '2026-11-24T10:00:00Z',
  partnerAssignmentId: null,
  ...overrides,
});

export const collection = (overrides: Record<string, unknown> = {}) => ({
  id: uuid('c201'),
  source: 'offline_cash',
  gross: xof(75000),
  allocatedCosts: xof(10000),
  allocatedInterests: xof(40000),
  allocatedPrincipal: xof(25000),
  overpaid: xof(0),
  commission: xof(7500),
  netToCreditor: xof(67500),
  stage: 'notice',
  receivedAt: '2026-11-24T10:00:00Z',
  walletTransactionId: null,
  receiptDocumentId: null,
  ...overrides,
});

export { caseSummary };
