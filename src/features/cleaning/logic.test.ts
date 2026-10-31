import { ApiError } from '@/lib/api';
import { cleaningAccess } from './access';
import { tabsFor } from './components/cleaning-tabs';
import { errorText } from './errors';
import { mission, quoteRequest, visit } from './fake-gateway.test-utils';
import { missionSchema, quoteRequestSchema } from './schemas';
import { customerLabel, nameOr, suspensionCauses } from './texts';

const labels = (roles: string[]) => tabsFor(cleaningAccess(roles)).map((tab) => tab.label);

describe('droits d’affichage du Nettoyage (le backend reste seul juge)', () => {
  it('l’admin voit toutes les sections', () => {
    expect(labels(['cleaning_admin'])).toEqual([
      'Demandes',
      'Missions',
      'Catalogue',
      'Zones',
      'Agents et équipes',
    ]);
  });

  it('le superviseur ne voit ni le catalogue ni les zones', () => {
    expect(labels(['cleaning_supervisor'])).toEqual(['Demandes', 'Missions', 'Agents et équipes']);
  });

  it('l’agent de terrain ne voit que ses missions', () => {
    expect(labels(['cleaning_agent'])).toEqual(['Missions']);
  });

  it('super_admin a la même portée que cleaning_admin (contrat)', () => {
    expect(labels(['super_admin'])).toEqual(labels(['cleaning_admin']));
    expect(cleaningAccess(['super_admin'])).toEqual({ supervise: true, administer: true, fieldWork: true });
  });
});

describe('schémas des réponses de la gateway', () => {
  it('lit une demande avec visite et une mission conformes au contrat', () => {
    expect(quoteRequestSchema.safeParse(quoteRequest({ visit: visit() })).success).toBe(true);
    expect(missionSchema.safeParse(mission()).success).toBe(true);
  });

  it('refuse un montant qui n’est pas en XOF entiers', () => {
    const bad = quoteRequest({
      estimate: { low: { amount: 90.5, currency: 'XOF' }, high: { amount: 1, currency: 'XOF' } },
    });
    expect(quoteRequestSchema.safeParse(bad).success).toBe(false);
  });

  it('garde un état inconnu (affiché avec un libellé neutre)', () => {
    expect(quoteRequestSchema.safeParse(quoteRequest({ status: 'nouvel_etat' })).success).toBe(true);
  });

  it('lit les noms affichés (ADR-029), présents, nuls ou absents', () => {
    const named = quoteRequestSchema.parse(
      quoteRequest({ customerName: 'Awa Bio', organizationName: null, visit: visit({ agentName: null }) }),
    );
    expect(named.customerName).toBe('Awa Bio');
    expect(quoteRequestSchema.parse(quoteRequest()).customerName).toBeUndefined();
  });

  it('exige les causes de la suspension (ADR-030)', () => {
    const since = '2026-10-28T10:00:00Z';
    const both = { cause: 'organization_suspended', causes: ['organization_suspended', 'unpaid_invoices'] };
    expect(missionSchema.safeParse(mission({ suspension: { ...both, since, unpaidCount: 2 } })).success).toBe(
      true,
    );
    expect(
      missionSchema.safeParse(mission({ suspension: { cause: 'unpaid_invoices', since, unpaidCount: 2 } }))
        .success,
    ).toBe(false);
  });
});

describe('textes calculés de l’affichage', () => {
  it('liste toutes les causes de suspension en clair', () => {
    expect(
      suspensionCauses({ causes: ['organization_suspended', 'unpaid_invoices'], unpaidCount: 2 }),
    ).toEqual(['Compte entreprise suspendu par KSP', '2 factures impayées']);
    expect(suspensionCauses({ causes: ['unpaid_interventions'], unpaidCount: 1 })).toEqual([
      '1 passage impayé',
    ]);
    expect(suspensionCauses({ causes: ['organization_suspended'], unpaidCount: 0 })).toEqual([
      'Compte entreprise suspendu par KSP',
    ]);
  });

  it('retombe sur un libellé court quand le nom manque', () => {
    expect(nameOr(null, 'un membre de l’équipe')).toBe('un membre de l’équipe');
    expect(customerLabel({ customerKind: 'business', customerName: 'Awa', organizationName: 'SARL' })).toBe(
      'SARL',
    );
    expect(customerLabel({ customerKind: 'business', customerName: null, organizationName: null })).toBe(
      'Entreprise sans nom',
    );
    expect(customerLabel({ customerKind: 'individual', customerName: undefined })).toBe('Client sans nom');
  });
});

describe('refus de la gateway précisés par leurs détails', () => {
  const refusal = (status: number, code: string, details: Record<string, unknown>) =>
    new ApiError(status, code, 'Message de la gateway.', details);

  it('rappelle le reste dû d’un paiement trop élevé', () => {
    const due = { remainingDue: { amount: 11220, currency: 'XOF' }, reason: 'exceeds_balance' };
    expect(errorText(refusal(400, 'CLEANING_PAYMENT_INVALID', due)).replace(/\s/g, ' ')).toBe(
      'Ce montant dépasse le reste dû. Reste dû : 11 220 F CFA.',
    );
    expect(errorText(refusal(400, 'CLEANING_PAYMENT_INVALID', { reason: 'other' }))).toBe(
      'Message de la gateway.',
    );
  });

  it('annonce le jour à partir duquel le passage ou la visite est possible', () => {
    expect(errorText(refusal(422, 'CLEANING_INTERVENTION_TOO_EARLY', { scheduledDate: '2026-11-05' }))).toBe(
      'Ce passage est prévu le jeu. 5 nov. 2026 : il pourra être démarré à partir de ce jour (heure du Bénin).',
    );
    expect(
      errorText(refusal(422, 'CLEANING_VISIT_TOO_EARLY', { scheduledAt: '2026-10-30T09:00:00Z' })),
    ).toContain('La visite est prévue le 30 oct. 2026');
    expect(errorText(refusal(422, 'CLEANING_ORGANIZATION_SUSPENDED', {}))).toContain('suspendu par KSP');
  });
});
