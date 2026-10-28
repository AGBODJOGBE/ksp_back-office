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

describe('menu des modules', () => {
  it('garde la place du menu tant que la session n’est pas reprise', () => {
    render(<SidebarNav modules={MODULES} />);
    expect(screen.getByRole('status')).toHaveTextContent('Chargement du menu…');
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  it('ne montre que les modules des rôles de la session', () => {
    render(<SidebarNav modules={MODULES} />);
    act(() => session.set(sessionBody(['recovery_agent'])));
    expect(links()).toEqual(['Tableau de bord', 'Recouvrement']);

    act(() => session.set(sessionBody(['super_admin'])));
    expect(links()).toEqual([
      'Tableau de bord',
      'Recouvrement',
      'Nettoyage',
      'Finance',
      'Clients et comptes',
      'Notifications',
      'Administration',
    ]);
  });

  it('indique la page courante, sous-pages comprises', () => {
    pathname = '/finance/factures';
    session.set(sessionBody(['finance_officer']));
    render(<SidebarNav modules={MODULES} />);
    const list = screen.getByRole('list');
    expect(within(list).getByRole('link', { name: 'Finance' })).toHaveAttribute('aria-current', 'page');
    expect(within(list).getByRole('link', { name: 'Tableau de bord' })).not.toHaveAttribute('aria-current');
  });

  it('reconnaît le module de chaque adresse', () => {
    expect(isCurrentModule('tableau-de-bord', '/')).toBe(true);
    expect(isCurrentModule('tableau-de-bord', '/finance')).toBe(false);
    expect(isCurrentModule('finance', '/finance')).toBe(true);
    expect(isCurrentModule('finance', '/financement')).toBe(false);
  });
});
