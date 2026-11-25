import { administrationTabs } from './administration-tabs';

describe('onglets de l’administration', () => {
  it('onglet « Rôles » réservé au super administrateur', () => {
    expect(administrationTabs(['cleaning_admin']).map((tab) => tab.label)).toEqual(['Comptes']);
    expect(administrationTabs(['super_admin']).map((tab) => tab.label)).toEqual(['Comptes', 'Rôles']);
    expect(administrationTabs(['super_admin'])[1]?.href).toBe('/administration/roles');
  });
});
