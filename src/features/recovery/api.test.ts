import { session } from '@/lib/api';
import { stubGateway } from '@/lib/api/gateway.test-utils';
import { sessionBody } from '@/lib/api/session.test-utils';
import { getMyDay, getOverview } from './api';
import {
  ADMIN,
  commissionInvoice,
  draftRule,
  INVOICES,
  overview,
  rule,
  settingsView,
  simulation,
  uuid,
  workItem,
} from './fixtures.test-utils';
import { getCommissionInvoice, listCommissionInvoices } from './invoices-api';
import { archiveRule, createRule, listRules, publishRule, simulate } from './pricing-api';
import { getHolidays, setHolidays, updateSettings } from './settings-api';

/* Client du Recouvrement contre une gateway simulée : chemins, requêtes, corps, validation des réponses. */

const ok = (body: unknown) => ({ status: 200, body });

beforeEach(() => session.set(sessionBody(['super_admin'])));
afterEach(() => vi.unstubAllGlobals());

describe('API du Recouvrement', () => {
  it('tableau de bord et Ma journée : réponses validées par leur schéma', async () => {
    const { calls } = stubGateway({
      [`GET ${ADMIN}/overview`]: ok(overview),
      [`GET ${ADMIN}/my-day`]: ok({ items: [workItem('dispute', '01')] }),
    });
    expect((await getOverview()).recoveryRateBps).toBe(2480);
    expect((await getMyDay('2026-11-25')).items[0]?.case.number).toBe('RC-2026-0001');
    expect(calls.map((call) => call.path + call.search)).toEqual([
      `${ADMIN}/overview`,
      `${ADMIN}/my-day?day=2026-11-25`,
    ]);
  });

  it('une réponse hors contrat est refusée (champ obligatoire absent, énumération inconnue)', async () => {
    const { entrusted: _removed, ...incomplete } = overview;
    stubGateway({
      [`GET ${ADMIN}/overview`]: ok(incomplete),
      [`GET ${ADMIN}/my-day`]: ok({ items: [workItem('unknown_kind', '01')] }),
    });
    await expect(getOverview()).rejects.toThrow();
    await expect(getMyDay()).rejects.toThrow();
  });

  it('règles : filtres du contrat, liste par curseur ramenée au format des listes', async () => {
    const { calls } = stubGateway({
      [`GET ${ADMIN}/pricing-rules`]: ok({ rules: [rule()], nextCursor: uuid('c0de') }),
    });
    const page = await listRules({ object: 'recovery_commission', status: 'published' })();
    expect(page).toMatchObject({
      data: [{ label: 'Commission B2B par tranches' }],
      nextCursor: uuid('c0de'),
    });
    expect(calls[0]?.search).toBe('?limit=20&object=recovery_commission&status=published');
  });

  it('brouillon créé avec la clé d’idempotence ; publication et archivage sans clé', async () => {
    const { calls } = stubGateway({
      [`POST ${ADMIN}/pricing-rules`]: ok(draftRule()),
      [`POST ${ADMIN}/pricing-rules/${uuid('a002')}/publish`]: ok(rule({ id: uuid('a002') })),
      [`POST ${ADMIN}/pricing-rules/${uuid('a002')}/archive`]: ok(
        rule({ id: uuid('a002'), status: 'archived' }),
      ),
    });
    const input = {
      object: 'case_fee' as const,
      mode: 'fixed' as const,
      fixedAmount: { amount: 15000, currency: 'XOF' as const },
      target: { offer: 'b2b' as const, communeKey: null, creditor: null },
      validFrom: '2026-11-30T23:00:00.000Z',
      label: 'Frais B2B',
    };
    await createRule(input, 'cle-1');
    await publishRule(uuid('a002'));
    await archiveRule(uuid('a002'), 'Remplacée par la grille 2027.');
    expect(calls[0]?.headers['Idempotency-Key']).toBe('cle-1');
    expect(calls[0]?.body).toEqual(input);
    expect(calls[1]?.headers['Idempotency-Key']).toBeUndefined();
    expect(calls[2]?.body).toEqual({ reason: 'Remplacée par la grille 2027.' });
  });

  it('simulation : corps du contrat, détail ligne par ligne', async () => {
    const { calls } = stubGateway({ [`POST ${ADMIN}/pricing-simulations`]: ok(simulation) });
    const result = await simulate({
      ruleId: uuid('a002'),
      object: 'recovery_commission',
      target: { offer: 'b2b' },
      baseAmount: { amount: 1100000, currency: 'XOF' },
      stage: 'formal_notice',
    });
    expect(result.lines).toHaveLength(2);
    expect(calls[0]?.body).toMatchObject({ ruleId: uuid('a002'), stage: 'formal_notice' });
  });

  it('réglages et jours fériés : PUT du contrat', async () => {
    const holidays = [{ date: '2026-08-01', label: 'Fête de l’indépendance' }];
    const { calls } = stubGateway({
      [`PUT ${ADMIN}/settings`]: ok(settingsView),
      [`GET ${ADMIN}/holidays/2026`]: ok({ holidays }),
      [`PUT ${ADMIN}/holidays/2026`]: ok({ holidays }),
    });
    await updateSettings(settingsView.settings as Parameters<typeof updateSettings>[0]);
    expect(await getHolidays(2026)).toEqual(holidays);
    expect(await setHolidays(2026, holidays)).toEqual(holidays);
    expect(calls.map((call) => `${call.method} ${call.path}`)).toEqual([
      `PUT ${ADMIN}/settings`,
      `GET ${ADMIN}/holidays/2026`,
      `PUT ${ADMIN}/holidays/2026`,
    ]);
    expect(calls[2]?.body).toEqual({ holidays });
  });

  it('factures de commission (billing) : liste filtrée et fiche', async () => {
    const { calls } = stubGateway({
      [`GET ${INVOICES}`]: ok({ data: [commissionInvoice()], nextCursor: null }),
      [`GET ${INVOICES}/${uuid('f001')}`]: ok(commissionInvoice()),
    });
    const page = await listCommissionInvoices({ status: 'pending_payment', period: '2026-10' })();
    expect(page.data[0]?.number).toBe('FCR-2026-000004');
    expect(calls[0]?.search).toBe('?limit=20&status=pending_payment&period=2026-10');
    expect((await getCommissionInvoice(uuid('f001'))).amountsExcludingTax).toBe(true);
  });
});
