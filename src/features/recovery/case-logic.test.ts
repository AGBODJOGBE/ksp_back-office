import { recoveryAccess } from './access';
import { caseSteps, estimatePlan, readCaseFilters, stageTargets } from './case-logic';
import { recoveryCase } from './case-fixtures.test-utils';
import { caseSchema } from './case-schemas';
import { uuid } from './fixtures.test-utils';
import { recoveryPaths } from './paths';

const params = (search: string) => new URLSearchParams(search);
const scale = recoveryCase().planScale as Parameters<typeof estimatePlan>[1];

describe('file des dossiers : filtres lus dans l’adresse', () => {
  it('traduit les paramètres en français vers les noms du contrat', () => {
    const agent = uuid('9e01');
    expect(
      readCaseFilters(
        params(
          `statut=under_review&etape=amicable&offre=b2c&charge=${agent}&commune=cotonou&inactifs=7&prescription=true`,
        ),
      ),
    ).toEqual({
      status: 'under_review',
      stage: 'amicable',
      kind: 'b2c',
      agentId: agent,
      communeKey: 'cotonou',
      idleDays: 7,
      prescriptionNear: true,
    });
  });

  it('ignore les valeurs hors contrat', () => {
    expect(
      readCaseFilters(params('statut=ouvert&etape=x&charge=abc&inactifs=400&prescription=oui&recherche=ab')),
    ).toEqual({});
    expect(readCaseFilters(params('inactifs=0'))).toEqual({});
  });

  it('les raccourcis du tableau de bord sont relus à l’identique', () => {
    const link = recoveryPaths.casesWith({ idleDays: 7, prescriptionNear: true });
    expect(readCaseFilters(params(link.split('?')[1] ?? ''))).toEqual({
      idleDays: 7,
      prescriptionNear: true,
    });
  });
});

describe('étapes de la fiche', () => {
  it('recevabilité en cours tant que le dossier est à l’examen', () => {
    expect(caseSteps({ status: 'under_review', stage: null })).toMatchObject({
      review: 'current',
      notice: 'upcoming',
    });
    expect(caseSteps({ status: 'awaiting_fee', stage: null }).review).toBe('upcoming');
  });

  it('étape amiable : les précédentes sont faites ; contentieux regroupé', () => {
    expect(caseSteps({ status: 'active', stage: 'payment_plan' })).toEqual({
      review: 'done',
      notice: 'done',
      payment_plan: 'current',
      amicable: 'upcoming',
      litigation: 'upcoming',
    });
    expect(caseSteps({ status: 'active', stage: 'bailiff' }).litigation).toBe('current');
    expect(caseSteps({ status: 'closed', stage: 'amicable' }).amicable).toBe('done');
  });

  it('changement d’étape : seulement vers les étapes amiables suivantes d’un dossier actif', () => {
    expect(stageTargets({ status: 'active', stage: 'notice' })).toEqual(['payment_plan', 'amicable']);
    expect(stageTargets({ status: 'active', stage: 'payment_plan' })).toEqual(['amicable']);
    expect(stageTargets({ status: 'active', stage: 'amicable' })).toEqual([]);
    expect(stageTargets({ status: 'active', stage: 'formal_notice' })).toEqual([]);
    expect(stageTargets({ status: 'suspended', stage: 'notice' })).toEqual([]);
  });
});

describe('estimation d’un échéancier (indicative)', () => {
  const today = '2026-11-25';

  it('dans le barème : reste, échéance arrondie à l’unité supérieure, dernière échéance', () => {
    const estimate = estimatePlan(
      400000,
      scale,
      { firstAmount: 100000, firstDueDate: '2026-11-30', rhythm: 'monthly', installmentsCount: 3 },
      today,
    );
    expect(estimate).toMatchObject({
      rest: 300000,
      installment: 100000,
      lastDueDate: '2027-02-28',
      issues: [],
    });
  });

  it('hors barème : premier versement, échéance minimale et durée signalés', () => {
    const estimate = estimatePlan(
      400000,
      scale,
      { firstAmount: 10000, firstDueDate: '2026-12-20', rhythm: 'weekly', installmentsCount: 52 },
      today,
    );
    expect(estimate.firstMinimum).toBe(40000);
    expect(estimate.installment).toBe(7500);
    expect(estimate.issues).toEqual(['first_payment', 'installment_minimum', 'duration']);
  });
});

describe('fiche et droits', () => {
  it('le schéma relit un dossier du contrat (champs non lus ignorés)', () => {
    const parsed = caseSchema.parse(recoveryCase());
    expect(parsed.amounts.due.amount).toBe(400000);
    expect('priorEffort' in parsed).toBe(false);
  });

  it('actions réservées aux rôles du contrat', () => {
    expect(recoveryAccess(['recovery_agent'])).toMatchObject({
      work: true,
      assess: false,
      stage: false,
      disputes: false,
    });
    expect(recoveryAccess(['recovery_supervisor'])).toMatchObject({
      assess: true,
      stage: true,
      disputes: false,
    });
    expect(recoveryAccess(['legal_officer'])).toMatchObject({ assess: false, stage: true, disputes: true });
    expect(recoveryAccess(['finance_officer'])).toMatchObject({
      work: false,
      offlinePayments: true,
      cases: true,
    });
  });
});
