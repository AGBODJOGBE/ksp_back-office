import { ApiError, session } from '@/lib/api';
import { sessionBody } from '@/lib/api/session.test-utils';
import { ADMIN, errorBody, ok, page, simulation, stubGateway } from './fake-gateway.test-utils';
import {
  approveQuoteAdjustment,
  cancelVisit,
  completeVisit,
  correctRequestLocation,
  countRequests,
  createQuote,
  decideReactivation,
  estimateRetainedValues,
  getQuote,
  getRequest,
  listRequests,
  listVisits,
  rejectRequest,
  removeVisitPhoto,
  reportVisitMissed,
  requestNewVisit,
  saveRetainedValues,
  scheduleVisit,
  sendQuote,
  updateQuoteDraft,
  updateVisit,
} from './requests-api';
import { errorText } from './errors';
import { readRequestFilters, requestQuery, toApiFilters, hasRequestFilters } from './requests-filters';
import { cleaningRequest, quote, requestIds, requestSummary, visit } from './requests-fixtures.test-utils';
import { requestSchema } from './requests-schemas';

const R = requestIds;
const KEY = 'cle-test-0001';

beforeEach(() => session.set(sessionBody(['cleaning_admin'])));
afterEach(() => vi.unstubAllGlobals());

describe('schémas des dossiers (contrat)', () => {
  it('fiche dossier complète : lue telle quelle', () => {
    const parsed = requestSchema.parse(cleaningRequest());
    expect(parsed.retained?.revision).toBe(1);
    expect(parsed.quoteHistory[0]?.adjustments[0]?.approvalStatus).toBe('pending');
    expect(parsed.visits[0]?.agents[0]?.isLead).toBe(true);
  });

  it('montants masqués (sans `cleaning.amounts.read`) : acceptés', () => {
    const { amount: _fee, ...fee } = cleaningRequest().visitFee;
    const { sessionPrice: _p, total: _t, visitFeeDeduction: _d, ...hidden } = quote();
    expect(requestSchema.safeParse(cleaningRequest({ visitFee: fee, currentQuote: hidden })).success).toBe(
      true,
    );
  });

  it('champ obligatoire absent ou statut hors contrat : réponse invalide', () => {
    const { warnings: _w, ...missing } = cleaningRequest();
    expect(requestSchema.safeParse(missing).success).toBe(false);
    expect(requestSchema.safeParse(cleaningRequest({ status: 'open' })).success).toBe(false);
  });
});

describe('client des dossiers', () => {
  it('file : filtres et pagination du contrat ; compteur sur une page d’un élément', async () => {
    const { calls } = stubGateway({
      [`GET ${ADMIN}/requests`]: page([requestSummary()], 'c2', 7),
    });
    const result = await listRequests({ status: 'visit_done', q: 'DN-1' })('c1');
    expect(result.total).toBe(7);
    const search = new URLSearchParams(calls[0]?.search);
    expect(Object.fromEntries(search)).toEqual({
      limit: '20',
      status: 'visit_done',
      q: 'DN-1',
      cursor: 'c1',
    });
    expect(await countRequests('visit_to_schedule')).toBe(7);
    expect(new URLSearchParams(calls[1]?.search).get('limit')).toBe('1');
  });

  it('écritures avec clé d’idempotence là où le contrat l’exige', async () => {
    const { calls } = stubGateway({
      [`POST ${ADMIN}/requests/${R.request}/reject`]: ok(cleaningRequest({ status: 'rejected' })),
      [`PUT ${ADMIN}/requests/${R.request}/location`]: ok({
        requestId: R.request,
        communeKey: 'cotonou',
        communeName: 'Cotonou',
        communeChanged: false,
        placeUpdated: true,
        correctedAt: '2026-11-25T10:00:00Z',
      }),
      [`POST ${ADMIN}/requests/${R.request}/reactivation`]: ok(cleaningRequest()),
      [`POST ${ADMIN}/requests/${R.request}/new-visit`]: ok(cleaningRequest({ status: 'visit_to_schedule' })),
      [`POST ${ADMIN}/visits`]: ok(visit()),
      [`PATCH ${ADMIN}/visits/${R.visit}`]: ok(visit()),
      [`POST ${ADMIN}/visits/${R.visit}/cancel`]: ok(visit({ status: 'cancelled', cancelCause: 'ksp' })),
      [`POST ${ADMIN}/visits/${R.visit}/complete`]: ok(visit({ status: 'completed' })),
      [`POST ${ADMIN}/visits/${R.visit}/missed`]: ok(visit({ status: 'missed' })),
      [`POST ${ADMIN}/visits/${R.visit}/photos/${R.photo}/remove`]: ok(visit()),
      [`POST ${ADMIN}/requests/${R.request}/quotes`]: ok(quote()),
      [`POST ${ADMIN}/quotes/${R.quote}/approve-adjustment`]: ok(quote()),
      [`POST ${ADMIN}/quotes/${R.quote}/send`]: ok(quote({ status: 'sent' })),
    });
    await rejectRequest(R.request, { reasonCode: 'other', reason: 'Hors zone' }, KEY);
    await correctRequestLocation(R.request, { latitude: 6.36, longitude: 2.41, reason: 'Repère' }, KEY);
    await decideReactivation(R.request, { decision: 'accept' }, KEY);
    await requestNewVisit(R.request, { reason: 'Agent absent' }, KEY);
    await scheduleVisit(
      { requestId: R.request, scheduledAt: '2026-11-28T09:00:00Z', agentIds: [R.agent] },
      KEY,
    );
    await updateVisit(R.visit, { scheduledAt: '2026-11-29T09:00:00Z' }, KEY);
    await cancelVisit(R.visit, { cause: 'ksp', reason: 'Intempéries' }, KEY);
    await completeVisit(R.visit, { reason: 'Saisie', completedAt: '2026-11-28T10:00:00Z' }, KEY);
    await reportVisitMissed(R.visit, { reason: 'Absent', missedAt: '2026-11-28T09:40:00Z' }, KEY);
    await removeVisitPhoto(R.visit, R.photo, { reason: 'Floue' }, KEY);
    await createQuote(R.request, { teamSize: 2 }, KEY);
    await approveQuoteAdjustment(R.quote, KEY);
    expect((await sendQuote(R.quote, KEY)).status).toBe('sent');
    expect(calls).toHaveLength(13);
    for (const call of calls) expect(call.headers['Idempotency-Key']).toBe(KEY);
    expect(calls[0]?.body).toEqual({ reasonCode: 'other', reason: 'Hors zone' });
    expect(calls.at(-1)?.body).toBeUndefined();
  });

  it('lectures et écritures sans clé : fiche, visites, version retenue, estimation, brouillon', async () => {
    const { calls } = stubGateway({
      [`GET ${ADMIN}/requests/${R.request}`]: ok(cleaningRequest()),
      [`GET ${ADMIN}/visits`]: page([visit()]),
      [`PUT ${ADMIN}/requests/${R.request}/retained-values`]: ok(cleaningRequest()),
      [`POST ${ADMIN}/requests/${R.request}/retained-values/estimate`]: ok(simulation().pricing),
      [`GET ${ADMIN}/quotes/${R.quote}`]: ok(quote()),
      [`PATCH ${ADMIN}/quotes/${R.quote}`]: ok(quote({ teamSize: 2 })),
    });
    expect((await getRequest(R.request)).number).toBe('DN-000124');
    expect((await listVisits({ status: 'scheduled', sort: '-scheduledAt' })()).data).toHaveLength(1);
    const body = { values: { superficie: 170 }, cleaningTypeIds: [R.request], reasons: [] };
    await saveRetainedValues(R.request, body);
    expect((await estimateRetainedValues(R.request, body)).status).toBe('priced');
    await getQuote(R.quote);
    expect((await updateQuoteDraft(R.quote, { teamSize: 2 })).teamSize).toBe(2);
    for (const call of calls) expect(call.headers['Idempotency-Key']).toBeUndefined();
    expect(new URLSearchParams(calls[1]?.search).get('sort')).toBe('-scheduledAt');
  });

  it('erreur métier du contrat : message de la gateway', async () => {
    stubGateway({
      [`POST ${ADMIN}/quotes/${R.quote}/send`]: {
        status: 422,
        body: errorBody('CLEANING_QUOTE_APPROVAL_REQUIRED', 'La remise doit être validée par un admin.'),
      },
    });
    const error = await sendQuote(R.quote, KEY).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('CLEANING_QUOTE_APPROVAL_REQUIRED');
    expect(errorText(error)).toBe('La remise doit être validée par un admin.');
  });
});

describe('filtres de la file (adresse → gateway)', () => {
  it('valeurs hors contrat ignorées ; dates au jour béninois, fin exclue au lendemain', () => {
    const values = readRequestFilters(
      new URLSearchParams('statut=visit_done&clientele=autre&du=2026-11-01&au=2026-11-30&lieu=pas-un-uuid'),
    );
    expect(values.status).toBe('visit_done');
    expect(values.customerKind).toBe('');
    expect(values.placeTypeId).toBe('');
    expect(toApiFilters(values)).toEqual({
      status: 'visit_done',
      from: '2026-10-31T23:00:00.000Z',
      to: '2026-11-30T23:00:00.000Z',
    });
    expect(hasRequestFilters(values)).toBe(true);
    expect(hasRequestFilters(readRequestFilters(new URLSearchParams('tri=createdAt')))).toBe(false);
  });

  it('modification de l’adresse : filtre posé ou retiré', () => {
    expect(requestQuery('statut=visit_done&tri=createdAt', { status: '', q: 'DN-1' })).toBe(
      'tri=createdAt&numero=DN-1',
    );
  });
});
