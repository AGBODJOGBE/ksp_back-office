import { countLabel, QUEUE_ROWS, sectionsFor, toQueuePage, type WorkQueueSection } from './work-queue';

const section = (id: string, roles: string[]): WorkQueueSection => ({
  id,
  title: id,
  description: '',
  roles,
  seeAll: { href: `/${id}`, label: id },
  load: async () => ({ rows: [], count: 0, more: false }),
});

describe('file « À traiter »', () => {
  const sections = [
    section('factures', ['finance_officer', 'super_admin']),
    section('incidents', ['cleaning_agent', 'super_admin']),
    section('ecarts', ['finance_officer', 'super_admin']),
    section('hors-ordre', ['super_admin']),
  ];
  const order = ['ecarts', 'incidents', 'factures'];

  it('garde les sections des rôles de la session, dans l’ordre de priorité', () => {
    expect(sectionsFor(['super_admin'], sections, order).map((s) => s.id)).toEqual([
      'ecarts',
      'incidents',
      'factures',
      'hors-ordre',
    ]);
    expect(sectionsFor(['finance_officer'], sections, order).map((s) => s.id)).toEqual([
      'ecarts',
      'factures',
    ]);
    expect(sectionsFor(['cleaning_agent'], sections, order).map((s) => s.id)).toEqual(['incidents']);
    expect(sectionsFor(['recovery_agent'], sections, order)).toEqual([]);
  });

  it('compte une page de la gateway : « N », ou « N+ » quand il existe une page suivante', () => {
    expect(countLabel({ count: 3, more: false })).toBe('3');
    expect(countLabel({ count: 20, more: true })).toBe('20+');
    expect(countLabel({ count: 0, more: false })).toBe('0');
  });

  it('ne garde que les premières lignes, sans changer l’ordre de la gateway', () => {
    const data = Array.from({ length: 20 }, (_, index) => `e${index}`);
    const page = toQueuePage({ data, nextCursor: 'suite' }, (item) => ({
      id: item,
      title: item,
      details: [],
      action: { kind: 'link', href: `/${item}`, label: 'Ouvrir' },
    }));
    expect(page.count).toBe(20);
    expect(page.more).toBe(true);
    expect(page.rows.map((row) => row.id)).toEqual(data.slice(0, QUEUE_ROWS));
  });
});
