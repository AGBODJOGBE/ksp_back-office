import { ADMIN, ok, page, stubGateway } from './fake-gateway.test-utils';
import { listProgramSessions, resumeProgram } from './programs-api';
import { program, programIds } from './programs-fixtures.test-utils';
import { programQuery, readProgramFilters, toProgramApiFilters } from './programs-filters';
import { hasUnpaid, programNextStep } from './programs-texts';
import type { Program } from './programs-schemas';
import { describeSchedule, scheduleDraftOf, scheduleErrors, scheduleOf } from './schedule-plan';

afterEach(() => vi.unstubAllGlobals());

describe('filtres des programmes', () => {
  it('valeurs hors contrat ignorées, numéro nettoyé, adresse en français', () => {
    const values = readProgramFilters(
      new URLSearchParams(
        'statut=paused&payeur=organization&commune=Cotonou&numero=%20PN-57%20&tri=createdAt',
      ),
    );
    expect(values).toMatchObject({
      status: '',
      payerKind: 'organization',
      communeKey: '',
      sort: 'createdAt',
    });
    expect(toProgramApiFilters(values)).toEqual({ payerKind: 'organization', q: 'PN-57', sort: 'createdAt' });
    expect(programQuery('payeur=organization', { status: 'suspended', payerKind: '' })).toBe(
      'statut=suspended',
    );
  });
});

describe('plan des séances', () => {
  it('décrit la semaine, le mois et la date unique', () => {
    expect(describeSchedule(program().schedule as Program['schedule'])).toBe(
      'Chaque semaine (lundi, jeudi) à 09:00, pendant 12 semaines',
    );
    expect(
      describeSchedule({
        kind: 'monthly',
        startTime: '08:30',
        monthDays: [1, 15],
        monthWeekdays: [{ rank: 'last', weekday: 'fri' }],
        durationMonths: 6,
      }),
    ).toBe('Chaque mois, le 1, 15, le dernier vendredi à 08:30, pendant 6 mois');
    expect(describeSchedule({ kind: 'one_off', startTime: '10:00', dates: ['2026-12-01'] })).toBe(
      'Ponctuel : 1 date, à 10:00',
    );
  });

  it('brouillon : contrôles aux chemins du contrat, plan envoyé', () => {
    const draft = { ...scheduleDraftOf({ kind: 'monthly', startTime: '25:00' }), monthDays: '0, 40' };
    expect(scheduleErrors(draft, 'addSchedule', 'Obligatoire')).toEqual({
      'addSchedule.startTime': 'Heure au format HH:MM.',
      'addSchedule.startDate': 'Obligatoire',
      'addSchedule.monthDays': 'Des jours de 1 à 31, séparés par des virgules.',
      'addSchedule.durationMonths': 'Entre 1 et 60.',
    });
    const weekly = { ...scheduleDraftOf(null), kind: 'weekly' as const, weekdays: ['thu', 'mon'] };
    expect(scheduleOf({ ...weekly, startDate: '2026-12-01', durationWeeks: '4' })).toEqual({
      kind: 'weekly',
      startTime: '09:00',
      excludeHolidays: true,
      weekdays: ['mon', 'thu'],
      everyWeeks: 1,
      startDate: '2026-12-01',
      durationWeeks: 4,
    });
    expect(scheduleOf(scheduleDraftOf(null))).toBeUndefined();
  });
});

describe('signaux d’un programme', () => {
  it('arrêt à valider, impayés, programme clos', () => {
    const base = program() as unknown as Program;
    const pending = { reason: 'x', requestedBy: programIds.other, requestedAt: '2026-11-21T10:00:00Z' };
    expect(programNextStep({ ...base, pendingCancellation: pending })).toEqual({
      label: 'Valider ou laisser l’arrêt demandé',
      action: true,
    });
    const unpaid = { cause: 'unpaid_invoices' as const, since: '2026-11-20T09:00:00Z', reason: null };
    expect(hasUnpaid({ suspensionCauses: [unpaid] })).toBe(true);
    expect(programNextStep({ ...base, status: 'suspended', suspensionCauses: [unpaid] }).label).toBe(
      'Suspendu : factures impayées',
    );
    expect(programNextStep({ ...base, status: 'cancelled' })).toEqual({
      label: 'Programme terminé',
      action: false,
    });
  });
});

describe('client d’api des programmes', () => {
  it('échéancier trié par début ; reprise : programme et séances à rattraper', async () => {
    const PROGRAM = `${ADMIN}/programs/${programIds.program}`;
    const catchUp = [
      { sessionId: programIds.session, rank: 4, previousStart: '2026-11-20T08:00:00Z', suggestedStart: null },
    ];
    const { calls } = stubGateway({
      [`GET ${PROGRAM}/sessions`]: page([]),
      [`POST ${PROGRAM}/resume`]: ok({ program: program(), catchUp }),
    });
    await listProgramSessions(programIds.program, { paymentStatus: 'overdue' })();
    const query = new URLSearchParams(calls[0]?.search);
    expect(query.get('sort')).toBe('scheduledStart');
    expect(query.get('paymentStatus')).toBe('overdue');
    const result = await resumeProgram(programIds.program, '', 'cle-1');
    expect(result.catchUp).toEqual(catchUp);
    expect(calls[1]?.body).toEqual({});
    expect(calls[1]?.headers['Idempotency-Key']).toBe('cle-1');
  });
});
