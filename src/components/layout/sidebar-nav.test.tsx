import { act, render, screen, within } from '@testing-library/react';
import { MODULES } from '@/config/modules';
import { session } from '@/lib/api/session';
import { sessionBody } from '@/lib/api/session.test-utils';
import { isCurrentModule, SidebarNav } from './sidebar-nav';

let pathname = '/';

vi.mock('next/navigation', () => ({ usePathname: () => pathname }));

beforeEach(() => {
  pathname = '/';
  session.clear();
});

const links = () => screen.getAllByRole('link').map((link) => link.textContent);
const groups = () =>
  screen.getAllByRole('list').map((list) => ({
    name:
      list.getAttribute('aria-label') ??
      document.getElementById(list.getAttribute('aria-labelledby') ?? '')?.textContent,
    links: within(list)
      .getAllByRole('link')
      .map((link) => link.textContent),
  }));

describe('menu des modules', () => {
  it('garde la place du menu tant que la session n’est pas reprise', () => {
    render(<SidebarNav modules={MODULES} />);
    expect(screen.getByRole('status')).toHaveTextContent('Chargement du menu…');
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  it('ne montre que les modules des rôles de la session', () => {
    render(<SidebarNav modules={MODULES} />);
    act(() => session.set(sessionBody(['recovery_agent'])));
    expect(links()).toEqual(['Ma journée', 'Recouvrement']);

    act(() => session.set(sessionBody(['super_admin'])));
    expect(links()).toEqual([
      'Ma journée',
      'Recouvrement',
      'Nettoyage',
      'Finance',
      'Clients et comptes',
      'Notifications',
      'Administration',
    ]);
  });

  it('range les modules par groupe et masque les groupes vides', () => {
    session.set(sessionBody(['super_admin']));
    const { unmount } = render(<SidebarNav modules={MODULES} />);
    expect(groups()).toEqual([
      { name: 'Ma journée', links: ['Ma journée'] },
      { name: 'Opérations', links: ['Recouvrement', 'Nettoyage'] },
      { name: 'Finance', links: ['Finance'] },
      { name: 'Clients', links: ['Clients et comptes'] },
      { name: 'Pilotage', links: ['Notifications', 'Administration'] },
    ]);
    unmount();

    session.set(sessionBody(['finance_officer']));
    render(<SidebarNav modules={MODULES} />);
    expect(groups().map((group) => group.name)).toEqual(['Ma journée', 'Finance']);
  });

  it('indique la page courante, sous-pages comprises', () => {
    pathname = '/finance/factures';
    session.set(sessionBody(['finance_officer']));
    render(<SidebarNav modules={MODULES} />);
    expect(screen.getByRole('link', { name: 'Finance' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Ma journée' })).not.toHaveAttribute('aria-current');
  });

  it('reconnaît le module de chaque adresse', () => {
    expect(isCurrentModule('tableau-de-bord', '/')).toBe(true);
    expect(isCurrentModule('tableau-de-bord', '/finance')).toBe(false);
    expect(isCurrentModule('finance', '/finance')).toBe(true);
    expect(isCurrentModule('finance', '/financement')).toBe(false);
  });
});
