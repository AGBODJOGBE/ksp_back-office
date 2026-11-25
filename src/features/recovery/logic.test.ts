import { MODULES } from '@/config/modules';
import { ApiError } from '@/lib/api';
import { fromRoles } from '@/lib/grants';
import { RECOVERY_MODULE_ROLES, recoveryAccess } from './access';
import { errorText, placeError } from './errors';
import { draftRule, rule, settings } from './fixtures.test-utils';
import { recoveryPaths } from './paths';
import { emptyRule, parsePercent, ruleInput, ruleValues, validateRule } from './pricing-form';
import { ruleSchema } from './pricing-schemas';
import { settingsInput, settingsValues, validateSettings } from './settings-form';
import { settingsSchema } from './settings-schemas';

const apiError = (code: string, message: string, details: Record<string, unknown> = {}, status = 422) =>
  new ApiError(status, code, message, details, 'c-test');

describe('droits d’affichage du Recouvrement (rôles du contrat)', () => {
  it('chaque rôle ouvre les écrans de ses routes', () => {
    expect(recoveryAccess(['recovery_agent'])).toMatchObject({
      overview: true,
      myDay: true,
      cases: true,
      offlinePayments: false,
      pricingRead: false,
      settings: false,
      holidaysRead: true,
      holidaysManage: false,
      commissionInvoices: false,
    });
    expect(recoveryAccess(['finance_officer'])).toMatchObject({
      overview: true,
      myDay: false,
      offlinePayments: true,
      pricingRead: true,
      pricingManage: false,
      settings: false,
      commissionInvoices: true,
    });
    const admin = recoveryAccess(fromRoles(['recovery_admin']));
    expect(Object.entries(admin).filter(([, value]) => !value)).toEqual([['offlinePayments', false]]);
    expect(Object.values(recoveryAccess(['super_admin'])).every(Boolean)).toBe(true);
    expect(Object.values(recoveryAccess(['cleaning_admin'])).some(Boolean)).toBe(false);
  });

  it('les permissions du jeton ne changent rien : le contrat n’en déclare pas', () => {
    expect(recoveryAccess({ roles: ['recovery_agent'], permissions: [] }).overview).toBe(true);
  });

  it('le menu ouvre le module à l’union des rôles de ses routes', () => {
    const recovery = MODULES.find((item) => item.slug === 'recouvrement');
    expect([...(recovery?.roles ?? [])].sort()).toEqual([...RECOVERY_MODULE_ROLES].sort());
  });
});

describe('adresses des files filtrées', () => {
  it('paramètres en français, valeurs encodées', () => {
    expect(recoveryPaths.casesWith({ stage: 'amicable', idleDays: 7 })).toBe(
      '/recouvrement/dossiers?etape=amicable&inactifs=7',
    );
    expect(recoveryPaths.casesWith({})).toBe('/recouvrement/dossiers');
    expect(recoveryPaths.newVersion('a b')).toBe('/recouvrement/tarification/nouvelle?version-de=a%20b');
  });
});

describe('saisie d’une règle tarifaire', () => {
  it('pourcentages en points de base, deux décimales au plus', () => {
    expect(parsePercent('12,5')).toBe(1250);
    expect(parsePercent('100')).toBe(10000);
    expect(parsePercent('100,01')).toBeNull();
    expect(parsePercent('1,234')).toBeNull();
  });

  it('tranches de commission : contrôles locaux puis corps du contrat (dernière tranche sans limite)', () => {
    const values = {
      ...emptyRule(),
      label: 'Commission par tranches',
      mode: 'tiered' as const,
      tiers: [
        { upTo: '1 000 000', value: '15' },
        { upTo: '', value: '10' },
      ],
      minimum: '5000',
      validFrom: '2026-12-01',
    };
    expect(validateRule(values)).toEqual({});
    expect(ruleInput(values)).toEqual({
      object: 'recovery_commission',
      mode: 'tiered',
      tiers: [
        { upTo: { amount: 1000000, currency: 'XOF' }, rateBps: 1500 },
        { upTo: null, rateBps: 1000 },
      ],
      minimum: { amount: 5000, currency: 'XOF' },
      target: { offer: 'any', communeKey: null, creditor: null },
      validFrom: '2026-11-30T23:00:00.000Z',
      label: 'Commission par tranches',
    });
    const wrong = {
      ...values,
      tiers: [
        { upTo: '500', value: '15' },
        { upTo: '400', value: 'x' },
        { upTo: '', value: '5' },
      ],
    };
    expect(validateRule(wrong)).toEqual({
      'tiers[1].upTo': 'Chaque borne doit dépasser la précédente.',
      'tiers[1].rateBps': expect.stringContaining('pourcentage'),
    });
  });

  it('frais de dossier par tranches : un montant par tranche, bornes et tarif négocié', () => {
    const values = {
      ...emptyRule(),
      label: 'Frais B2B',
      object: 'case_fee' as const,
      mode: 'tiered' as const,
      tiers: [
        { upTo: '500000', value: '10000' },
        { upTo: '', value: '25000' },
      ],
      minimum: '30000',
      maximum: '20000',
      negotiated: true,
      creditorId: 'pas-un-uuid',
      validFrom: '2026-12-01',
      validUntil: '2026-11-01',
    };
    expect(validateRule(values)).toEqual({
      minimum: 'Le minimum dépasse le maximum.',
      'target.creditor': 'Identifiant attendu au format UUID.',
      validUntil: 'La fin doit suivre le début.',
    });
    const fixed = { ...values, minimum: '', maximum: '', negotiated: false, validUntil: '' };
    expect(ruleInput(fixed).tiers).toEqual([
      { upTo: { amount: 500000, currency: 'XOF' }, fixedAmount: { amount: 10000, currency: 'XOF' } },
      { upTo: null, fixedAmount: { amount: 25000, currency: 'XOF' } },
    ]);
  });

  it('relit une règle de la gateway : seul l’objet dit si la tranche porte un taux ou un montant', () => {
    expect(ruleValues(ruleSchema.parse(rule())).tiers).toEqual([
      { upTo: '1000000', value: '15' },
      { upTo: '', value: '10' },
    ]);
    const fee = draftRule({
      object: 'case_fee',
      tiers: [
        {
          upTo: { amount: 500000, currency: 'XOF' },
          rateBps: -1,
          fixedAmount: { amount: 10000, currency: 'XOF' },
        },
        { upTo: null, rateBps: -1, fixedAmount: { amount: 25000, currency: 'XOF' } },
      ],
    });
    const values = ruleValues(ruleSchema.parse(fee));
    expect(values.tiers).toEqual([
      { upTo: '500000', value: '10000' },
      { upTo: '', value: '25000' },
    ]);
    expect(ruleInput(values, 'prev').previousVersionId).toBe('prev');
  });
});

describe('saisie des réglages', () => {
  it('aller-retour sans perte, pourcentages en points de base', () => {
    const parsed = settingsSchema.parse(settings);
    expect(settingsInput(settingsValues(parsed))).toEqual(settings);
  });

  it('bornes du contrat vérifiées avant l’envoi', () => {
    const values = settingsValues(settingsSchema.parse(settings));
    const wrong = {
      ...values,
      days: { ...values.days, formalNoticeDays: '7', prescriptionAlertDays: '400' },
      contactDays: [],
      contactStart: '8h',
      weights: { ...values.weights, amount: '120' },
    };
    expect(validateSettings(wrong)).toEqual({
      formalNoticeDays: 'Entre 8 et 60.',
      prescriptionAlertDays: 'Entre 30 et 365.',
      'contactWindow.start': 'Heure attendue au format HH:MM.',
      'contactWindow.days': 'Choisissez au moins un jour.',
      'scoreWeights.amount': 'Entre 0 et 100.',
    });
  });
});

describe('erreurs métier lisibles', () => {
  it('règle incomplète : liste des points à corriger', () => {
    const error = apiError('RECOVERY_PRICING_RULE_INVALID', 'Cette règle tarifaire est incomplète.', {
      violations: ['la dernière tranche est sans limite', 'le minimum dépasse le maximum'],
    });
    expect(errorText(error)).toBe(
      'Cette règle tarifaire est incomplète. À corriger : la dernière tranche est sans limite ; le minimum dépasse le maximum.',
    );
  });

  it('validation par l’auteur, contentieux pas encore livré, erreur du serveur avec référence', () => {
    expect(errorText(apiError('RECOVERY_APPROVAL_BY_REQUESTER', 'x', {}, 403))).toMatch(/autre personne/);
    expect(errorText(apiError('RECOVERY_NOT_IMPLEMENTED', 'x', {}, 501))).toMatch(/procédure contentieuse/);
    expect(errorText(apiError('RECOVERY_UNAVAILABLE', 'Service indisponible.', {}, 503))).toBe(
      'Service indisponible. Référence pour le support : c-test.',
    );
  });

  it('réglage hors bornes : message placé sous le champ nommé', () => {
    const error = apiError(
      'RECOVERY_SETTING_OUT_OF_BOUNDS',
      'Entre 8 et 60 jours.',
      { field: 'formalNoticeDays' },
      400,
    );
    expect(placeError(error, ['formalNoticeDays'])).toEqual({
      field: 'formalNoticeDays',
      message: 'Entre 8 et 60 jours.',
    });
    expect(placeError(error, [])).toEqual({ field: null, message: 'Entre 8 et 60 jours.' });
  });
});
