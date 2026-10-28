import { isModuleVisible, visibleModules, waitingModules } from './visible-modules';

const slugs = (roles: string[], phase?: number) => visibleModules(roles, phase).map((module) => module.slug);

describe('accès aux modules du back-office', () => {
  it('un agent de recouvrement voit le tableau de bord et son métier seulement', () => {
    expect(slugs(['recovery_agent'])).toEqual(['tableau-de-bord', 'recouvrement']);
  });

  it('le super administrateur voit tous les modules de la phase en cours', () => {
    expect(slugs(['super_admin'])).toEqual([
      'tableau-de-bord',
      'recouvrement',
      'nettoyage',
      'finance',
      'clients',
      'notifications',
      'administration',
    ]);
  });

  it('les modules des phases suivantes restent masqués', () => {
    expect(slugs(['print_admin'])).toEqual(['tableau-de-bord']);
    expect(slugs(['print_admin'], 3)).toEqual(['tableau-de-bord', 'impression']);
  });

  it('un agent sans rôle métier ne voit que le tableau de bord', () => {
    expect(slugs([])).toEqual(['tableau-de-bord']);
  });

  it('refuse un module hors des rôles de l’agent', () => {
    expect(isModuleVisible('finance', ['recovery_agent'])).toBe(false);
    expect(isModuleVisible('finance', ['finance_officer'])).toBe(true);
  });

  it('un agent de terrain du Nettoyage voit son module', () => {
    expect(slugs(['cleaning_agent'])).toEqual(['tableau-de-bord', 'nettoyage']);
  });

  it('un module qui a ses propres écrans n’a plus de page d’attente', () => {
    const waiting = waitingModules().map((module) => module.slug);
    expect(waiting).not.toContain('nettoyage');
    expect(waiting).not.toContain('tableau-de-bord');
    expect(waiting).toEqual(['recouvrement', 'finance', 'clients', 'notifications', 'administration']);
    expect(waitingModules(1, []).map((module) => module.slug)).toContain('nettoyage');
  });
});
