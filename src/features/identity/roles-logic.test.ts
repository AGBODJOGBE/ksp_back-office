import { groupPermissions, permissionChanges, retiredPermissions } from './roles-logic';

const entry = (code: string, retired = false) => ({
  code,
  description: code,
  service: code.split('.')[0] as string,
  module: code.split('.')[1] as string,
  retired,
});
const catalog = [
  entry('cleaning.claim.manage'),
  entry('cleaning.planning.manage'),
  entry('cleaning.request.read'),
  entry('wallet.payout.approve'),
  entry('cleaning.old.read', true),
];

describe('rôles dynamiques : règles d’affichage', () => {
  it('groupe le catalogue par service puis module, dans l’ordre de la gateway', () => {
    const groups = groupPermissions(catalog);
    expect(groups.map((group) => group.service)).toEqual(['cleaning', 'wallet']);
    expect(groups[0]?.modules.map((block) => block.module)).toEqual(['claim', 'planning', 'request', 'old']);
  });

  it('résume les permissions ajoutées et retirées', () => {
    expect(permissionChanges(['a.b.c', 'a.b.d'], ['a.b.d', 'a.b.e'])).toEqual({
      added: ['a.b.e'],
      removed: ['a.b.c'],
    });
  });

  it('signale les permissions retirées ou inconnues du catalogue', () => {
    expect(retiredPermissions(['cleaning.old.read', 'cleaning.request.read', 'x.y.z'], catalog)).toEqual([
      'cleaning.old.read',
      'x.y.z',
    ]);
  });
});
