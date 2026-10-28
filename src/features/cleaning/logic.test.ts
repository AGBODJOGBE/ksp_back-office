import { cleaningAccess } from './access';
import { tabsFor } from './components/cleaning-tabs';
import { mission, quoteRequest, visit } from './fake-gateway.test-utils';
import { missionSchema, quoteRequestSchema } from './schemas';

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

  it('super_admin n’ouvre pas les routes du Nettoyage (contrat)', () => {
    expect(labels(['super_admin'])).toEqual([]);
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
});
