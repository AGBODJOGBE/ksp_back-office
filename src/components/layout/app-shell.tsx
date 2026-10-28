import type { ReactNode } from 'react';
import { Logo } from '@/components/ui/brand/logo';
import { buttonClasses } from '@/components/ui/button';
import { IconClose, IconMenu } from '@/components/ui/icons';
import { MODULES } from '@/config/modules';
import { siteConfig } from '@/config/site';
import { getDictionary } from '@/i18n';
import { cn } from '@/lib/cn';
import { SidebarNav } from './sidebar-nav';
import { SidebarPanel } from './sidebar-panel';

/* Identifiant repris par les boutons d'ouverture et de fermeture (popovertarget). */
const MENU_ID = 'menu-back-office';

const LOGO = { href: '/', label: `${siteConfig.name}, tableau de bord`, suffix: 'Back-office' } as const;

/*
 * Le même élément est un tiroir sur téléphone (popover) et une colonne fixe sur grand écran : les styles
 * du navigateur pour `[popover]` (position fixe, marge automatique, bordure, masqué s'il est fermé) sont
 * neutralisés à partir de `lg`.
 */
const PANEL = cn(
  'border-line bg-surface text-ink flex-col border-0 border-r p-0',
  'max-lg:drawer-panel max-lg:shadow-raised max-lg:fixed max-lg:inset-y-0 max-lg:right-auto max-lg:left-0 max-lg:m-0',
  'max-lg:h-dvh max-lg:max-h-none max-lg:w-[min(20rem,88vw)] max-lg:overflow-y-auto max-lg:open:flex',
  'lg:sticky lg:inset-auto lg:top-0 lg:m-0 lg:flex lg:h-dvh lg:w-auto lg:overflow-y-auto',
);

/**
 * Cadre du back-office : menu des modules à gauche (tiroir sur téléphone), contenu à droite.
 * Composant serveur : seules les feuilles client lisent la session (menu filtré par rôle, compte).
 * `account` : panneau du compte fourni par la route (une fonctionnalité, que ce cadre n'importe pas).
 */
export function AppShell({ children, account }: { children: ReactNode; account?: ReactNode }) {
  const t = getDictionary();
  return (
    <div className="bg-canvas min-h-dvh lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
      <header className="border-line bg-canvas sticky top-0 z-(--z-header) flex h-(--header-h) items-center justify-between gap-3 border-b px-4 lg:hidden">
        <Logo {...LOGO} />
        <button
          type="button"
          popoverTarget={MENU_ID}
          aria-label={t.shell.openMenu}
          className={buttonClasses({ variant: 'secondary', size: 'icon' })}
        >
          <IconMenu />
        </button>
      </header>

      <SidebarPanel id={MENU_ID} label={t.shell.menu} className={PANEL}>
        <div className="flex h-(--header-h) shrink-0 items-center justify-between gap-2 px-4 lg:h-20 lg:px-5">
          <Logo {...LOGO} />
          <button
            type="button"
            popoverTarget={MENU_ID}
            popoverTargetAction="hide"
            aria-label={t.shell.closeMenu}
            className={buttonClasses({ variant: 'ghost', size: 'icon', className: 'lg:hidden' })}
          >
            <IconClose />
          </button>
        </div>
        <nav aria-label={t.shell.modules} className="flex-1 px-3 pt-2 pb-6">
          <p aria-hidden="true" className="text-eyebrow text-ink-subtle mb-2 px-3 font-semibold uppercase">
            {t.shell.modules}
          </p>
          <SidebarNav modules={MODULES} />
        </nav>
        {account ? <div className="border-line border-t p-4">{account}</div> : null}
      </SidebarPanel>

      <main id="contenu" tabIndex={-1} className="min-w-0 focus:outline-none">
        <div className="max-w-page px-gutter mx-auto w-full py-8 lg:py-12">{children}</div>
      </main>
    </div>
  );
}
