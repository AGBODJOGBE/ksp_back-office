import type { Visit } from './requests-schemas';
import {
  calendarQuery,
  gridHours,
  periodDays,
  readCalendar,
  shiftDay,
  toVisitFilters,
  visitsByDay,
  visitTimes,
  weekStart,
} from './visits-calendar';

const AGENT = '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d3101';
const at = (id: string, scheduledAt: string) => ({ id, scheduledAt, durationMinutes: 90 }) as Visit;

describe('calendrier des visites : adresse et période', () => {
  it('lit la vue, le jour et les filtres ; une valeur hors contrat vaut « tous »', () => {
    const params = new URLSearchParams(
      `vue=jour&date=2026-11-25&statut=scheduled&agent=${AGENT}&commune=cotonou`,
    );
    expect(readCalendar(params, '2026-01-01')).toEqual({
      view: 'jour',
      day: '2026-11-25',
      status: 'scheduled',
      agentId: AGENT,
      communeKey: 'cotonou',
    });
    const invalid = new URLSearchParams('vue=mois&date=2026-13-45&statut=done&agent=x&commune=Cotonou');
    expect(readCalendar(invalid, '2026-11-25')).toEqual({
      view: 'semaine',
      day: '2026-11-25',
      status: '',
      agentId: '',
      communeKey: '',
    });
  });

  it('semaine du lundi au dimanche, bornes au Bénin (UTC+1), `to` exclu', () => {
    expect(weekStart('2026-11-25')).toBe('2026-11-23');
    expect(weekStart('2026-11-29')).toBe('2026-11-23');
    expect(periodDays({ view: 'semaine', day: '2026-12-30' })).toEqual([
      '2026-12-28',
      '2026-12-29',
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
      '2027-01-03',
    ]);
    const values = readCalendar(new URLSearchParams('date=2026-11-25&statut=missed'));
    expect(toVisitFilters(values)).toEqual({
      from: '2026-11-22T23:00:00.000Z',
      to: '2026-11-29T23:00:00.000Z',
      status: 'missed',
    });
    expect(toVisitFilters({ ...values, view: 'jour', status: '' })).toEqual({
      from: '2026-11-24T23:00:00.000Z',
      to: '2026-11-25T23:00:00.000Z',
    });
  });

  it('précédent / suivant : un jour ou une semaine ; adresse sans valeur vide', () => {
    expect(shiftDay({ view: 'jour', day: '2026-11-30' }, 1)).toBe('2026-12-01');
    expect(shiftDay({ view: 'semaine', day: '2026-11-25' }, -1)).toBe('2026-11-18');
    expect(calendarQuery('vue=jour&statut=missed', { status: '', day: '2026-11-26' })).toBe(
      'vue=jour&date=2026-11-26',
    );
  });
});

describe('calendrier des visites : rangement', () => {
  it('range par jour du Bénin, dans l’ordre, avec heures de début et de fin', () => {
    const late = at('b', '2026-11-25T23:30:00Z'); // 26 nov., 00:30 au Bénin
    const early = at('a', '2026-11-25T08:00:00Z');
    const days = visitsByDay([late, early]);
    expect([...days.keys()]).toEqual(['2026-11-25', '2026-11-26']);
    expect(visitTimes(early)).toEqual({ start: '09:00', end: '10:30' });
    expect(gridHours([early])).toEqual([7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
    expect(gridHours([late])[0]).toBe(0);
  });
});
