import { ApiError } from '@/lib/api';
import { calculation, groupedRequest, ids, quoteRequest, visit } from './fake-gateway.test-utils';
import { groupErrorText, skippedLines } from './group-errors';
import {
  groupOutcomeSchema,
  locationCorrectionSchema,
  type QuoteRequest,
  quoteRequestSchema,
} from './schemas';
import { groupPrimaryAction, primaryAction, readLocationInput } from './workflow';

const parse = (overrides: Record<string, unknown> = {}) => quoteRequestSchema.parse(quoteRequest(overrides));
const parseGrouped = (overrides: Record<string, unknown> = {}) =>
  quoteRequestSchema.parse(groupedRequest(overrides));

const quote = {
  id: ids.quote,
  lines: [],
  subtotal: { amount: 10000, currency: 'XOF' },
  interventionCount: 1,
  total: { amount: 10000, currency: 'XOF' },
  proposedSlots: [{ start: '2026-11-05T08:00:00Z', end: '2026-11-05T11:00:00Z' }],
  validUntil: '2026-11-20T00:00:00Z',
  depositPercent: 30,
  depositAmount: { amount: 3000, currency: 'XOF' },
  recurrence: null,
  teamSize: 2,
  durationMinutes: 180,
  sentAt: '2026-11-01T10:00:00Z',
};

describe('action principale d’une demande selon l’état', () => {
  it.each([
    ['reçue', {}, { kind: 'schedule_visit', scope: 'request' }],
    ['visite planifiée', { status: 'visit_scheduled', visit: visit() }, { kind: 'report', scope: 'request' }],
    [
      'visite faite, sans devis',
      { status: 'visit_scheduled', visit: visit({ status: 'completed' }) },
      { kind: 'quote', scope: 'request' },
    ],
    ['devis envoyé', { status: 'quote_sent', visit: visit({ status: 'completed' }), quote }, null],
    [
      'acceptée',
      { status: 'accepted', visit: visit({ status: 'completed' }), quote, missionId: ids.mission },
      { kind: 'mission', scope: 'request' },
    ],
    ['refusée', { status: 'rejected', closingReason: 'Hors zone' }, null],
    [
      'visite annulée',
      { status: 'received', visit: visit({ status: 'cancelled' }) },
      { kind: 'schedule_visit', scope: 'request' },
    ],
  ])('%s', (_label, overrides, expected) => {
    expect(primaryAction(parse(overrides))).toEqual(expected);
  });

  it('dans un groupe, la visite et le devis se font sur la vue du groupe', () => {
    expect(primaryAction(parseGrouped())).toEqual({ kind: 'schedule_visit', scope: 'group' });
    expect(
      primaryAction(parseGrouped({ status: 'visit_scheduled', visit: visit({ groupVisitId: ids.visit }) })),
    ).toEqual({ kind: 'report', scope: 'group' });
    expect(
      primaryAction(parseGrouped({ status: 'visit_scheduled', visit: visit({ status: 'completed' }) })),
    ).toEqual({ kind: 'quote', scope: 'group' });
  });

  it('une visite propre à une demande du groupe garde son compte rendu sur la fiche', () => {
    expect(
      primaryAction(parseGrouped({ status: 'visit_scheduled', visit: visit({ groupVisitId: null }) })),
    ).toEqual({ kind: 'report', scope: 'request' });
  });
});

describe('action principale d’un groupe', () => {
  const requests = (...overrides: Array<Record<string, unknown>>) =>
    overrides.map((item) => parseGrouped(item));

  it('compte rendu commun si la visite commune est planifiée', () => {
    expect(
      groupPrimaryAction(
        requests({ status: 'visit_scheduled', visit: visit({ groupVisitId: ids.visit }) }, {}),
      ),
    ).toBe('report');
  });

  it('visite commune s’il reste une demande sans visite', () => {
    expect(groupPrimaryAction(requests({}, { status: 'quote_sent', quote }))).toBe('visit');
  });

  it('devis groupés quand les visites sont faites, aucune action quand tout est envoyé ou clos', () => {
    expect(
      groupPrimaryAction(
        requests(
          { status: 'visit_scheduled', visit: visit({ status: 'completed' }) },
          { status: 'rejected' },
        ),
      ),
    ).toBe('quotes');
    expect(groupPrimaryAction(requests({ status: 'quote_sent', quote }, { status: 'accepted' }))).toBeNull();
  });
});

describe('erreurs et résultats des opérations de groupe', () => {
  const group: QuoteRequest[] = [
    parseGrouped({ id: ids.request }),
    parseGrouped({ id: ids.intervention, serviceCode: 'window_cleaning', serviceName: 'Vitres TEST' }),
  ];

  it('nomme la demande en cause (`details.requestId`) devant le message de la gateway', () => {
    const error = new ApiError(422, 'CLEANING_PRICE_NOT_SET', 'Prix non fixé.', {
      requestId: ids.intervention,
    });
    expect(groupErrorText(error, group)).toBe('Demande « Vitres TEST » : Prix non fixé.');
    expect(groupErrorText(new ApiError(422, 'X', 'Refus.'), group)).toBe('Refus.');
  });

  it('donne la raison de chaque demande laissée de côté', () => {
    expect(
      skippedLines(
        [
          { requestId: ids.intervention, status: 'quote_sent', reason: 'transition_not_allowed' },
          { requestId: ids.request, status: 'visit_scheduled', reason: 'own_visit' },
          { requestId: 'inconnue', status: 'x', reason: 'nouvelle_raison' },
        ],
        group,
      ),
    ).toEqual([
      'Vitres TEST : son état ne le permet pas',
      'Nettoyage de maison TEST : elle a sa propre visite',
      'inconnue : nouvelle_raison',
    ]);
  });

  it('lit un résultat de groupe et une correction de position conformes au contrat', () => {
    const requests = [groupedRequest()];
    expect(
      groupOutcomeSchema.safeParse({
        groupId: ids.request,
        affectedRequestIds: [ids.request],
        skipped: [],
        groupVisitId: null,
        missionIds: [],
        requests,
      }).success,
    ).toBe(true);
    expect(
      locationCorrectionSchema.safeParse({
        request: groupedRequest({ calculation: calculation({ priced: false, computedPrice: null }) }),
        updatedRequestIds: [ids.request],
        updatedMissionIds: [],
      }).success,
    ).toBe(true);
  });
});

describe('correction de la position', () => {
  const values = (overrides: Partial<Record<string, string>> = {}) => ({
    latitude: '6,3703',
    longitude: '2.3912',
    accuracyMeters: '',
    landmark: '',
    commune: '',
    ...overrides,
  });

  it('lit les décimales françaises et laisse de côté les champs facultatifs vides', () => {
    expect(readLocationInput(values())).toEqual({
      ok: true,
      input: { latitude: 6.3703, longitude: 2.3912 },
    });
    expect(
      readLocationInput(values({ accuracyMeters: '8', landmark: ' Portail vert ', commune: 'Cotonou' })),
    ).toEqual({
      ok: true,
      input: {
        latitude: 6.3703,
        longitude: 2.3912,
        accuracyMeters: 8,
        landmark: 'Portail vert',
        commune: 'Cotonou',
      },
    });
  });

  it.each([
    [{ latitude: '' }, 'latitude'],
    [{ latitude: '91' }, 'latitude'],
    [{ longitude: '-181' }, 'longitude'],
    [{ longitude: 'abc' }, 'longitude'],
    [{ accuracyMeters: '100001' }, 'accuracyMeters'],
    [{ landmark: 'x'.repeat(501) }, 'landmark'],
    [{ commune: 'x'.repeat(101) }, 'commune'],
  ])('refuse %o (bornes du contrat)', (overrides, field) => {
    expect(readLocationInput(values(overrides))).toEqual({ ok: false, field });
  });
});
