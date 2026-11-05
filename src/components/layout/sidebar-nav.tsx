'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useId } from 'react';
import type { BackofficeModule } from '@/config/modules';
import { getDictionary } from '@/i18n';
import { cn } from '@/lib/cn';
// Import direct du magasin de session : ni configuration ni zod pour ce composant présent partout.
import { useSession } from '@/lib/api/session';
import { groupModules, visibleModules } from '@/lib/navigation/visible-modules';
import { ModuleIcon } from './module-icon';

/** Adresse d'un module : « Ma journée » (`tableau-de-bord`) est l'accueil. */
export function moduleHref(slug: string): string {
  return slug === 'tableau-de-bord' ? '/' : `/${slug}`;
}

/** Le module est-il celui de la page affichée (ou d'une de ses sous-pages) ? */
export function isCurrentModule(slug: string, pathname: string): boolean {
  const href = moduleHref(slug);
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

/*
 * Menu posé sur le cadre bleu nuit (`data-tone="inverse"`) : encres claires, voile clair au survol.
 * Page courante : fond éclairci, encre blanche en gras, liseré et icône or (l'or est permis sur le bleu
 * nuit) — jamais la couleur seule.
 */
const ITEM = cn(
  'group/item rounded-control relative isolate flex min-h-11 items-center gap-3 px-3 text-[0.9375rem] font-medium',
  'text-ink-muted hover:text-ink',
  'before:bg-brand-soft before:absolute before:inset-0 before:-z-10 before:rounded-[inherit] before:opacity-0',
  'before:ease-soft before:transition-opacity before:duration-(--motion-base) hover:before:opacity-100',
  'aria-[current=page]:text-ink aria-[current=page]:bg-white/10 aria-[current=page]:font-semibold',
  'after:bg-accent after:absolute after:inset-y-2 after:left-0 after:w-1 after:rounded-full after:opacity-0',
  'aria-[current=page]:after:opacity-100',
);

const SKELETON_WIDTHS = ['62%', '78%', '55%', '70%', '84%', '66%'];

/**
 * Menu des modules, rangés par groupe (Ma journée, Opérations, Finance, Clients, Pilotage) : filtré par
 * les rôles de la session (affichage seulement, la gateway reste seule juge des droits) et par la phase en
 * cours ; la page courante est marquée (`aria-current`). Reçoit le catalogue du cadre (serveur). Sans
 * session, un squelette garde la place du menu. Aucun compteur : il coûterait des appels à chaque page.
 */
export function SidebarNav({ modules }: { modules: readonly BackofficeModule[] }) {
  const t = getDictionary();
  const id = useId();
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
              <span className="bg-brand-soft size-5 shrink-0 rounded-md" />
              <span className="bg-brand-soft h-3 rounded-full" style={{ width }} />
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      {groupModules(visibleModules(current.roles, undefined, modules)).map((group) => {
        const heading = `${id}-${group.id}`;
        // « Ma journée » n'a qu'une entrée du même nom : pas de titre visible, la liste garde son nom.
        const titled = group.id !== 'journee';
        return (
          <div key={group.id}>
            {titled ? (
              <p id={heading} className="text-eyebrow text-ink-subtle mb-1.5 px-3 font-semibold uppercase">
                {group.label}
              </p>
            ) : null}
            <ul
              aria-labelledby={titled ? heading : undefined}
              aria-label={titled ? undefined : group.label}
              className="grid gap-1"
            >
              {group.modules.map((item) => {
                const active = isCurrentModule(item.slug, pathname);
                return (
                  <li key={item.slug}>
                    <Link
                      href={moduleHref(item.slug)}
                      aria-current={active ? 'page' : undefined}
                      className={ITEM}
                    >
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
          </div>
        );
      })}
    </div>
  );
}
