import { loginHref, safeReturnPath } from './return-path';

describe('retour après la connexion', () => {
  it.each([
    ['/finance', '/finance'],
    ['/recouvrement?dossier=12#suivi', '/recouvrement?dossier=12#suivi'],
    ['/', '/'],
  ])('garde un chemin interne (%s)', (value, expected) => {
    expect(safeReturnPath(value)).toBe(expected);
  });

  it.each([
    null,
    '',
    'finance',
    'https://autre-site.example/piege',
    '//autre-site.example',
    '/\\autre-site.example',
    '/\t/autre-site.example',
    'javascript:alert(1)',
    '/connexion',
    '/connexion?retour=/finance',
  ])('refuse tout le reste et revient au tableau de bord (%s)', (value) => {
    expect(safeReturnPath(value)).toBe('/');
  });

  it('construit l’adresse de connexion avec le retour encodé', () => {
    expect(loginHref('/finance?onglet=factures')).toBe('/connexion?retour=%2Ffinance%3Fonglet%3Dfactures');
    expect(loginHref('/')).toBe('/connexion');
    expect(loginHref('https://autre-site.example')).toBe('/connexion');
  });
});
