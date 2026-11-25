import { session } from '@/lib/api';
import { sessionBody } from '@/lib/api/session.test-utils';
import {
  activeAgents,
  approveAgent,
  countAgents,
  createAgent,
  deactivateAgent,
  declareUnavailability,
  getAgentIdDocument,
  getAvailability,
  inviteAgent,
  listAgents,
  listTeams,
  reactivateAgent,
  rejectAgent,
  removeUnavailability,
  reviewAgent,
  setAvailability,
  suspendAgent,
  updateAgent,
  updateTeam,
  createTeam,
} from './agents-api';
import { agentQuery, formatPhone, readAgentFilters, toAgentFilters, toBeninE164 } from './agents-filters';
import { agent, agentIds, availability, idDocument, team } from './agents-fixtures.test-utils';
import { agentSchema, availabilitySchema, teamSchema } from './agents-schemas';
import { dayError, toExtraSlots, toWeekDraft, toWeekly, weekErrors } from './availability-edit';
import { ADMIN, ok, page, stubGateway } from './fake-gateway.test-utils';

const A = agentIds;
const KEY = 'cle-test-0001';

beforeEach(() => session.set(sessionBody(['cleaning_admin'])));
afterEach(() => vi.unstubAllGlobals());

describe('schémas des agents (contrat)', () => {
  it('fiche agent, disponibilités et équipe lues telles quelles', () => {
    expect(agentSchema.parse(agent()).skills[1]?.validated).toBe(false);
    expect(availabilitySchema.parse(availability()).unavailabilities[0]?.kind).toBe('leave');
    expect(teamSchema.parse(team()).members).toHaveLength(2);
  });

  it('champ obligatoire absent ou statut hors contrat : réponse refusée', () => {
    const { stats: _stats, ...partial } = agent();
    expect(agentSchema.safeParse(partial).success).toBe(false);
    expect(agentSchema.safeParse(agent({ status: 'archived' })).success).toBe(false);
  });
});

describe('client des agents', () => {
  it('liste : filtres du contrat ; compteur sur une page d’un élément ; agents actifs', async () => {
    const { calls } = stubGateway({ [`GET ${ADMIN}/agents`]: page([agent()], 'c2', 5) });
    const result = await listAgents({ status: 'applicant', zoneKey: 'cotonou', q: 'Koffi' })('c1');
    expect(result.total).toBe(5);
    expect(Object.fromEntries(new URLSearchParams(calls[0]?.search))).toEqual({
      limit: '20',
      status: 'applicant',
      zoneKey: 'cotonou',
      q: 'Koffi',
      cursor: 'c1',
    });
    expect(await countAgents('under_review')).toBe(5);
    expect(new URLSearchParams(calls[1]?.search).get('limit')).toBe('1');
    stubGateway({ [`GET ${ADMIN}/agents`]: page([agent()]) });
    expect((await activeAgents())[0]?.zoneKeys).toEqual(['cotonou', 'abomey-calavi']);
  });

  it('écritures avec clé d’idempotence là où le contrat l’exige', async () => {
    const { calls } = stubGateway({
      [`POST ${ADMIN}/agents`]: ok(agent({ status: 'under_review' })),
      [`POST ${ADMIN}/agents/invitations`]: ok({
        id: A.invitation,
        phone: '+2290197000045',
        expiresAt: '2026-11-27T10:00:00Z',
      }),
      [`POST ${ADMIN}/agents/${A.agent}/review`]: ok(agent({ status: 'under_review' })),
      [`POST ${ADMIN}/agents/${A.agent}/approve`]: ok(agent()),
      [`POST ${ADMIN}/agents/${A.agent}/reject`]: ok(agent({ status: 'rejected' })),
      [`POST ${ADMIN}/agents/${A.agent}/suspend`]: ok(agent({ status: 'suspended' })),
      [`POST ${ADMIN}/agents/${A.agent}/reactivate`]: ok(agent()),
      [`POST ${ADMIN}/agents/${A.agent}/deactivate`]: ok(agent({ status: 'deactivated' })),
      [`POST ${ADMIN}/agents/${A.agent}/unavailabilities`]: ok(availability()),
      [`POST ${ADMIN}/teams`]: ok(team()),
    });
    const created = await createAgent(
      {
        phone: '+2290197000045',
        firstName: 'Koffi',
        lastName: 'AGBO TEST',
        photoFileId: A.front,
        idDocumentFrontFileId: A.front,
        idDocumentBackFileId: A.back,
        residenceCommuneKey: 'cotonou',
        zoneKeys: ['cotonou'],
        skillCodes: ['nettoyage_interieur'],
        weekly: [{ weekday: 'mon', ranges: [{ start: '08:00', end: '12:00' }] }],
        emergencyContact: { name: 'Afi', phone: '+2290196000011' },
        employmentKind: 'employee',
      },
      KEY,
    );
    expect(created.status).toBe('under_review');
    expect((await inviteAgent('+2290197000045', KEY)).id).toBe(A.invitation);
    await reviewAgent(A.agent, KEY);
    await approveAgent(A.agent, ['nettoyage_interieur'], KEY);
    await rejectAgent(A.agent, 'Pièce illisible', KEY);
    await suspendAgent(A.agent, 'Absences', KEY);
    await reactivateAgent(A.agent, KEY);
    await deactivateAgent(A.agent, { reassign: true, reason: 'Départ' }, KEY);
    await declareUnavailability(
      A.agent,
      { start: '2026-12-01T07:00:00Z', end: '2026-12-02T07:00:00Z', kind: 'sickness', force: true },
      KEY,
    );
    await createTeam({ name: 'Équipe', leadAgentId: A.agent, memberIds: [A.agent] }, KEY);
    expect(calls).toHaveLength(10);
    for (const call of calls) expect(call.headers['Idempotency-Key']).toBe(KEY);
    expect(calls[1]?.body).toEqual({ phone: '+2290197000045' });
    expect(calls[2]?.body).toBeUndefined();
    expect(calls[3]?.body).toEqual({ validatedSkillCodes: ['nettoyage_interieur'] });
    expect(calls[7]?.body).toEqual({ reassign: true, reason: 'Départ' });
  });

  it('sans clé : modification, disponibilités, retrait d’une indisponibilité, équipes, pièce', async () => {
    const { calls } = stubGateway({
      [`PATCH ${ADMIN}/agents/${A.agent}`]: ok(agent({ zoneKeys: [] })),
      [`GET ${ADMIN}/agents/${A.agent}/availability`]: ok(availability()),
      [`PUT ${ADMIN}/agents/${A.agent}/availability`]: ok(availability()),
      [`DELETE ${ADMIN}/agents/${A.agent}/unavailabilities/${A.unavailability}`]: ok(
        availability({ unavailabilities: [] }),
      ),
      [`GET ${ADMIN}/teams`]: page([team()]),
      [`PATCH ${ADMIN}/teams/${A.team}`]: ok(team({ active: false })),
      [`GET ${ADMIN}/agents/${A.agent}/id-document`]: ok(idDocument()),
    });
    expect((await updateAgent(A.agent, { zoneKeys: [] })).zoneKeys).toEqual([]);
    expect((await getAvailability(A.agent)).maxHoursPerDay).toBe(8);
    await setAvailability(A.agent, { weekly: [], extraAvailabilities: [], force: true });
    expect((await removeUnavailability(A.agent, A.unavailability)).unavailabilities).toEqual([]);
    await listTeams({ active: false })();
    expect((await updateTeam(A.team, { active: false })).active).toBe(false);
    expect((await getAgentIdDocument(A.agent)).back.fileId).toBe(A.back);
    for (const call of calls) expect(call.headers['Idempotency-Key']).toBeUndefined();
    expect(calls[2]?.body).toEqual({ weekly: [], extraAvailabilities: [], force: true });
    expect(new URLSearchParams(calls[4]?.search).get('active')).toBe('false');
  });
});

describe('filtres de l’adresse et téléphones', () => {
  it('valeurs hors contrat ignorées ; tri par nom absent ; adresse mise à jour', () => {
    const values = readAgentFilters(
      new URLSearchParams('statut=applicant&commune=Cotonou&competence=vitres_hauteur&tri=lastName'),
    );
    expect(values).toEqual({
      status: 'applicant',
      zoneKey: '',
      skillCode: 'vitres_hauteur',
      q: '',
      sort: 'lastName',
    });
    expect(toAgentFilters(values)).toEqual({ status: 'applicant', skillCode: 'vitres_hauteur' });
    expect(agentQuery('statut=applicant', { status: '', q: 'Ama' })).toBe('recherche=Ama');
  });

  it('numéros béninois au format +229 01 (ADR-063)', () => {
    expect(toBeninE164('01 97 00 00 45')).toBe('+2290197000045');
    expect(toBeninE164('97 00 00 45')).toBe('+2290197000045');
    expect(toBeninE164('+229 97000045')).toBe('+2290197000045');
    expect(toBeninE164('00229 01 97 00 00 45')).toBe('+2290197000045');
    expect(toBeninE164('+33 6 12 34 56 78')).toBe('+33612345678');
    expect(toBeninE164('+229 123')).toBeNull();
    expect(toBeninE164('12345')).toBeNull();
    expect(formatPhone('+2290197000045')).toBe('+229 01 97 00 00 45');
  });
});

describe('saisie des disponibilités', () => {
  it('semaine type : aller-retour, jours vides retirés, plages triées', () => {
    const draft = toWeekDraft(availability().weekly as never);
    expect(draft.tue).toEqual([]);
    draft.wed = [
      { start: '14:00', end: '18:00' },
      { start: '08:00', end: '12:00' },
    ];
    expect(toWeekly(draft)).toEqual([
      { weekday: 'mon', ranges: [{ start: '08:00', end: '12:00' }] },
      {
        weekday: 'wed',
        ranges: [
          { start: '08:00', end: '12:00' },
          { start: '14:00', end: '18:00' },
        ],
      },
    ]);
  });

  it('plage inversée, chevauchement, trop de plages ; exceptions en heure du Bénin', () => {
    expect(dayError([{ start: '12:00', end: '08:00' }])).toMatch(/heure de fin/);
    expect(
      dayError([
        { start: '08:00', end: '12:00' },
        { start: '11:00', end: '13:00' },
      ]),
    ).toMatch(/chevauchent/);
    expect(dayError(Array.from({ length: 7 }, () => ({ start: '08:00', end: '09:00' })))).toMatch(/6 plages/);
    const draft = toWeekDraft([]);
    draft.fri = [{ start: '18:00', end: '18:00' }];
    expect(Object.keys(weekErrors(draft))).toEqual(['weekly.fri']);
    expect(toExtraSlots([{ start: '2026-12-05T08:00', end: '2026-12-05T12:00' }])).toEqual([
      { start: '2026-12-05T07:00:00.000Z', end: '2026-12-05T11:00:00.000Z' },
    ]);
    expect(toExtraSlots([{ start: '2026-12-05T12:00', end: '2026-12-05T08:00' }])).toEqual({ invalid: 0 });
  });
});
