import { fromRoles } from '@/lib/grants';
import { isModuleVisible, visibleModules, waitingModules } from './visible-modules';

const slugs = (roles: string[], phase?: number) =>
  visibleModules(fromRoles(roles), phase).map((module) => module.slug);

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
    expect(isModuleVisible('finance', fromRoles(['recovery_agent']))).toBe(false);
    expect(isModuleVisible('finance', fromRoles(['finance_officer']))).toBe(true);
    // Rôles du contrat : factures ouvertes au Nettoyage, comptes entreprise au support seul.
    expect(isModuleVisible('finance', fromRoles(['cleaning_supervisor']))).toBe(true);
    expect(isModuleVisible('clients', fromRoles(['support_agent']))).toBe(true);
    expect(isModuleVisible('clients', fromRoles(['cleaning_admin']))).toBe(false);
    // Notifications (ADR-039) : direction et support client seulement.
    expect(isModuleVisible('notifications', fromRoles(['support_agent']))).toBe(true);
    expect(isModuleVisible('notifications', fromRoles(['cleaning_admin']))).toBe(false);
  });

  it('Nettoyage v2 : ouvert au support, plus à l’agent de terrain (application de l’agent)', () => {
    expect(slugs(['cleaning_agent'])).toEqual(['tableau-de-bord']);
    expect(isModuleVisible('nettoyage', fromRoles(['support_agent']))).toBe(true);
    expect(isModuleVisible('nettoyage', fromRoles(['cleaning_supervisor']))).toBe(true);
  });

  describe('permissions du jeton (ADR-057)', () => {
    const grants = (roles: string[], permissions: string[]) => ({ roles, permissions });

    it('un rôle créé au back-office ouvre le Nettoyage par ses permissions, sans changer le code', () => {
      const planner = grants(['cleaning_planner'], ['cleaning.planning.manage', 'cleaning.request.read']);
      expect(visibleModules(planner).map((module) => module.slug)).toEqual(['tableau-de-bord', 'nettoyage']);
    });

    it('jeton avec permissions : elles seules décident pour un module qui en déclare', () => {
      // Rôle par défaut vidé de ses permissions au back-office : le module se ferme.
      expect(isModuleVisible('nettoyage', grants(['cleaning_supervisor'], []))).toBe(false);
      // Permissions de l'application de l'agent : aucun écran du back-office.
      expect(isModuleVisible('nettoyage', grants([], ['cleaning.session.perform']))).toBe(false);
    });

    it('les modules sans permission au contrat décident encore par rôle', () => {
      const finance = grants(['finance_officer'], ['cleaning.catalog.read']);
      expect(isModuleVisible('finance', finance)).toBe(true);
      expect(isModuleVisible('clients', finance)).toBe(false);
      expect(isModuleVisible('finance', grants(['cleaning_planner'], ['cleaning.catalog.read']))).toBe(false);
    });
  });

  it('un module qui a ses propres écrans n’a plus de page d’attente', () => {
    const waiting = waitingModules().map((module) => module.slug);
    expect(waiting).not.toContain('nettoyage');
    expect(waiting).not.toContain('tableau-de-bord');
    expect(waiting).not.toContain('finance');
    expect(waiting).not.toContain('clients');
    expect(waiting).not.toContain('notifications');
    expect(waiting).not.toContain('recouvrement');
    expect(waiting).toEqual([]);
    expect(waitingModules(1, []).map((module) => module.slug)).toContain('nettoyage');
  });
});
