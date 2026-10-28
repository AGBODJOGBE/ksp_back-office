'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';

export interface SubNavItem {
  href: string;
  label: string;
  /** Adresses supplémentaires qui rendent l'onglet courant (fiches rattachées à l'onglet). */
  match?: readonly string[];
}

/** L'onglet est-il celui de la page affichée (ou d'une de ses sous-pages) ? `exact` : seulement la page elle-même. */
export function isCurrentTab(item: SubNavItem, pathname: string, exact = false): boolean {
  return [item.href, ...(item.match ?? [])].some((href) =>
    exact && href === item.href ? pathname === href : pathname === href || pathname.startsWith(`${href}/`),
  );
}

/**
 * Navigation interne d'un module, présentée en onglets : des liens (l'adresse change, l'état se
 * partage), la page courante marquée par `aria-current`. Défile horizontalement sur téléphone.
 * À faire converger avec le portail avant `ksp-ui` (F-003).
 */
export function SubNav({
  label,
  items,
  rootHref,
  className,
}: {
  label: string;
  items: readonly SubNavItem[];
  /** Onglet racine du module : courant seulement sur sa propre adresse (et ses `match`). */
  rootHref?: string;
  className?: string;
}) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className={cn('border-line -mx-gutter overflow-x-auto border-b', className)}>
      <ul className="px-gutter flex min-w-max gap-1">
        {items.map((item) => {
          const active = isCurrentTab(item, pathname, item.href === rootHref);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex min-h-11 items-center px-3 text-[0.9375rem] font-medium whitespace-nowrap',
                  'text-ink-muted hover:text-ink rounded-t-control',
                  'after:bg-accent after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:opacity-0',
                  'aria-[current=page]:text-ink aria-[current=page]:font-semibold aria-[current=page]:after:opacity-100',
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
