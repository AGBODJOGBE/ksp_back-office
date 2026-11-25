import { currentStep, draftQuote, nextAction, stepStates } from './request-steps';
import { requestSchema } from './requests-schemas';
import { cleaningRequest, quote, visit } from './requests-fixtures.test-utils';

/** Dossier TEST validé par le schéma du contrat. */
const request = (overrides: Record<string, unknown> = {}) => requestSchema.parse(cleaningRequest(overrides));

describe('étapes du dossier', () => {
  it.each([
    ['awaiting_visit_fee', { visits: [] }, 'request', 'waitFee'],
    ['visit_to_schedule', { visits: [] }, 'visit', 'scheduleVisit'],
    ['visit_scheduled', { visits: [visit()] }, 'visit', 'waitVisit'],
    ['visit_missed', {}, 'visit', 'waitFee'],
    ['visit_done', { retained: null, quoteHistory: [] }, 'retained', 'retain'],
    ['visit_done', { quoteHistory: [] }, 'retained', 'composeQuote'],
    ['visit_done', {}, 'quote', 'approveAdjustment'],
    ['visit_done', { quoteHistory: [quote({ adjustments: [] })] }, 'quote', 'sendQuote'],
    ['quote_sent', { quoteHistory: [], currentQuote: quote({ status: 'sent' }) }, 'quote', 'waitCustomer'],
    ['accepted', { programId: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d8001' }, 'follow', 'openProgram'],
    ['accepted', {}, 'follow', 'accepted'],
    ['rejected', { visits: [], retained: null, quoteHistory: [] }, 'request', 'closed'],
    ['declined', {}, 'quote', 'closed'],
  ])('%s %o : étape %s, action %s', (status, overrides, step, action) => {
    const value = request({ status, ...overrides });
    expect(currentStep(value)).toBe(step);
    expect(nextAction(value).key).toBe(action);
  });

  it('dossier clos : l’étape atteinte est marquée arrêtée, les précédentes terminées', () => {
    const states = stepStates(request({ status: 'rejected', quoteHistory: [], retained: null }));
    expect(states).toEqual({
      request: 'done',
      visit: 'stopped',
      retained: 'todo',
      quote: 'todo',
      follow: 'todo',
    });
  });

  it('réactivation demandée : décision attendue, étape en cours et non arrêtée', () => {
    const value = request({
      status: 'expired',
      reactivation: { requestedAt: '2026-12-01T09:00:00Z', status: 'pending', decidedAt: null },
    });
    expect(nextAction(value)).toEqual({ key: 'decideReactivation', step: 'request', action: true });
    expect(stepStates(value).quote).toBe('current');
  });

  it('brouillon : la version la plus haute', () => {
    const value = request({
      quoteHistory: [
        quote({ version: 1 }),
        quote({ id: 'x', version: 3 }),
        quote({ status: 'superseded', version: 4 }),
      ],
    });
    expect(draftQuote(value)?.version).toBe(3);
  });
});
