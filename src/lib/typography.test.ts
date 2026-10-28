import { frenchSpacing } from './typography';

describe('typographie française', () => {
  it('lie les signes doubles au mot qui les précède', () => {
    expect(frenchSpacing('Combien coûte le recouvrement ?')).toBe('Combien coûte le recouvrement ?');
    expect(frenchSpacing('« Texte » : fin ; oui !')).toBe('« Texte » : fin ; oui !');
  });
});
