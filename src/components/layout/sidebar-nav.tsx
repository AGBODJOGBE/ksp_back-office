'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { BackofficeModule } from '@/config/modules';
import { getDictionary } from '@/i18n';
import { cn } from '@/lib/cn';
// Import direct du magasin de session : ni configuration ni zod pour ce composant présent partout.
import { useSession } from '@/lib/api/session';
import { visibleModules } from '@/lib/navigation/visible-modules';
import { ModuleIcon } from './module-icon';

/** Adresse d'un module : le tableau de bord est l'accueil. */
export function moduleHref(slug: string): string {
  return slug === 'tableau-de-bord' ? '/' : `/${slug}`;
}

/** Le module est-il celui de la page affichée (ou d'une de ses sous-pages) ? */
export function isCurrentModule(slug: string, pathname: string): boolean {
  const href = moduleHref(slug);
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

const ITEM = cn(
  'group/item hover-veil rounded-control relative flex min-h-11 items-center gap-3 px-3 text-[0.9375rem] font-medium',
  'text-ink-muted hover:text-ink',
  // Page courante : fond ocre clair, encre pleine, gras et liseré d'accent (pas la couleur seule).
  'aria-[current=page]:bg-accent-soft aria-[current=page]:text-ink aria-[current=page]:font-semibold',
  'after:bg-accent after:absolute after:inset-y-2 after:left-0 after:w-1 after:rounded-full after:opacity-0',
  'aria-[current=page]:after:opacity-100',
);

const SKELETON_WIDTHS = ['62%', '78%', '55%', '70%', '84%', '66%'];

/**
 * Menu des modules : filtré par les rôles de la session (affichage seulement, la gateway reste seule
 * juge des droits) et par la phase en cours ; la page courante est marquée (`aria-current`).
 * Reçoit le catalogue du cadre (serveur). Sans session, un squelette garde la place du menu.
 */
export function SidebarNav({ modules }: { modules: readonly BackofficeModule[] }) {
  const t = getDictionary();
  const pathname = usePathname();
  const current = useSession();

  if (!current) {
    return (
      <div>
        <p role="status" className="sr-only">
          {t.shell.loadingMenu}
        </p>
        <ul aria-hidden="true" className="grid gap-1">
          {SKELETON_WIDTHS.map((width) => (
            <li key={width} className="flex min-h-11 items-center gap-3 px-3">
              <span className="bg-surface-sunken size-5 shrink-0 rounded-md" />
              <span className="bg-surface-sunken h-3 rounded-full" style={{ width }} />
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <ul className="grid gap-1">
      {visibleModules(current.roles, undefined, modules).map((item) => {
        const active = isCurrentModule(item.slug, pathname);
        return (
          <li key={item.slug}>
            <Link href={moduleHref(item.slug)} aria-current={active ? 'page' : undefined} className={ITEM}>
              <ModuleIcon
                slug={item.slug}
                className="text-ink-subtle group-aria-[current=page]/item:text-accent-ink size-5"
              />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
