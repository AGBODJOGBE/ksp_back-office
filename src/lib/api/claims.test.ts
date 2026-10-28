import { accessToken } from './session.test-utils';
import { rolesFromAccessToken } from './claims';

const segment = (value: unknown) =>
  btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

describe('rôles du jeton d’accès', () => {
  it('lit les codes des rôles, sans doublon', () => {
    expect(rolesFromAccessToken(accessToken(['recovery_agent', 'recovery_agent', 'support_agent']))).toEqual([
      'recovery_agent',
      'support_agent',
    ]);
  });

  it('lit un contenu encodé en base64url avec des caractères accentués', () => {
    const claims = { roles: [{ role: 'super_admin', scopeType: 'global' }], note: 'Équipe à Cotonou ?>' };
    const bytes = new TextEncoder().encode(JSON.stringify(claims));
    const payload = btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    expect(rolesFromAccessToken(`h.${payload}.s`)).toEqual(['super_admin']);
  });

  it.each([
    ['jeton opaque', 'opaque'],
    ['contenu illisible', 'a.%%%.b'],
    ['sans rôles', `h.${segment({ sub: 'u1' })}.s`],
    ['rôles mal formés', `h.${segment({ roles: [{ role: 'Super Admin' }, 'texte', null] })}.s`],
  ])('renvoie une liste vide pour un %s', (_label, token) => {
    expect(rolesFromAccessToken(token)).toEqual([]);
  });
});
