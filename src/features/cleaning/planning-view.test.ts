import { agentCheckSchema, assignmentSchema, planningSchema } from './planning-schemas';
import { agentCheck, assignment, planning, planningIds, planningItem } from './planning-fixtures.test-utils';
import {
  assignmentKey,
  hasBlockingFailure,
  indexAssignments,
  itemsByDay,
  itemTimes,
  loadShare,
  overridableFailures,
  planningQuery,
  readPlanning,
  staffing,
  toPlanningFilters,
} from './planning-view';

const params = (query: string) => new URLSearchParams(query);

describe('planning : adresse et période', () => {
  it('lit la vue, le jour et les filtres valides ; ignore le reste', () => {
    expect(
      readPlanning(
        params(`vue=jour&date=2026-11-28&agent=${planningIds.koffi}&commune=cotonou`),
        '2026-11-25',
      ),
    ).toEqual({
      view: 'jour',
      day: '2026-11-28',
      agentId: planningIds.koffi,
      teamId: '',
      zoneKey: 'cotonou',
    });
    expect(readPlanning(params('vue=mois&date=2026-02-31&equipe=x&commune=A'), '2026-11-25')).toEqual({
      view: 'semaine',
      day: '2026-11-25',
      agentId: '',
      teamId: '',
      zoneKey: '',
    });
  });

  it('envoie la semaine du lundi au lundi suivant, à minuit au Bénin', () => {
    const values = readPlanning(params(`date=2026-11-25&equipe=${planningIds.team}`));
    expect(toPlanningFilters(values)).toEqual({
      from: '2026-11-22T23:00:00.000Z',
      to: '2026-11-29T23:00:00.000Z',
      teamId: planningIds.team,
    });
  });

  it('modifie l’adresse : valeur vide = paramètre retiré', () => {
    expect(planningQuery('vue=jour&agent=a', { agentId: '', zoneKey: 'cotonou' })).toBe(
      'vue=jour&commune=cotonou',
    );
  });
});

describe('planning : interventions', () => {
  it('valide la réponse du contrat et range par jour du Bénin', () => {
    const data = planningSchema.parse(
      planning({ items: [planningItem(), planningItem({ id: 'b', start: '2026-11-25T23:30:00Z' })] }),
    );
    const byDay = itemsByDay(data.items);
    expect([...byDay.keys()]).toEqual(['2026-11-25', '2026-11-26']);
    expect(itemTimes(data.items[0]!)).toEqual({ start: '09:00', end: '12:00' });
  });

  it('effectif : un agent sur deux manque', () => {
    expect(staffing({ agents: [planningItem().agents[0]!] as never, teamSize: 2 })).toEqual({
      count: 1,
      full: false,
      missing: 1,
    });
  });

  it('charge en heures et part du maximum', () => {
    expect(loadShare(390, 2880)).toEqual({ label: '6 h 30', percent: 14 });
    expect(loadShare(120, 0)).toEqual({ label: '2 h', percent: null });
  });
});

describe('affectations : contrôles et index', () => {
  it('sépare les échecs contournables des échecs bloquants', () => {
    const checks = [
      agentCheckSchema.parse(agentCheck(planningIds.koffi, [{ check: 'load', overridable: true }])),
      agentCheckSchema.parse(
        agentCheck(planningIds.awa, [
          { check: 'zone', overridable: true },
          { check: 'availability', overridable: true, overridden: true },
        ]),
      ),
    ];
    expect(overridableFailures(checks)).toEqual(['zone', 'load']);
    expect(hasBlockingFailure(checks)).toBe(false);
    const blocking = [
      agentCheckSchema.parse(agentCheck(planningIds.awa, [{ check: 'skills', overridable: false }])),
    ];
    expect(hasBlockingFailure(blocking)).toBe(true);
  });

  it('indexe les affectations actives par cible et agent ; retire les retirées', () => {
    const active = assignmentSchema.parse(assignment());
    const key = assignmentKey(active.target, active.agentId);
    const indexed = indexAssignments(new Map(), [active]);
    expect(indexed.get(key)?.id).toBe(planningIds.assignment);
    expect(indexAssignments(indexed, [{ ...active, status: 'removed' }]).has(key)).toBe(false);
  });
});
