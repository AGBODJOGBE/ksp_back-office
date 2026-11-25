'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { cleaningPaths } from '@/features/cleaning/paths';
import {
  CATALOG_HOME_LABEL,
  CATALOG_STEPS,
  CATALOG_STEPS_LABEL,
  SETTINGS_SECTIONS,
  SETTINGS_SECTIONS_LABEL,
  TEAM_SECTIONS,
  TEAM_SECTIONS_LABEL,
} from '@/features/cleaning/sections';

export interface SectionNavItem {
  href: string;
  label: string;
  /** Rang dans un ordre à suivre (étapes du catalogue), affiché et lu (« Étape 1 : Paramètres »). */
  step?: number;
  /** Autres préfixes d'adresse qui rendent l'entrée courante (fiches rattachées). */
  match?: readonly string[];
}

/**
 * Navigation d'une section du module (étapes du catalogue, réglages) : des liens en pastilles, la page
 * courante marquée par `aria-current`. Défile horizontalement sur téléphone.
 */
export function SectionNav({
  label,
  items,
  rootHref,
}: {
  label: string;
  items: readonly SectionNavItem[];
  /** Entrée qui n'est courante que sur sa propre adresse (page d'accueil de la section). */
  rootHref?: string;
}) {
  const pathname = usePathname();
  return (
    // `relative` : les libellés `sr-only` (position absolue) restent dans le conteneur qui défile,
    // sinon ils élargissent la page à 375 px.
    <nav aria-label={label} className="-mx-gutter relative overflow-x-auto">
      <ul className="px-gutter flex min-w-max gap-2 pb-1">
        {items.map((item) => {
          const under = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
          const current =
            (item.href === rootHref ? pathname === item.href : under(item.href)) ||
            (item.match ?? []).some(under);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={current ? 'page' : undefined}
                className={cn(
                  'rounded-control border-line text-ink-muted hover:text-ink hover:border-line-strong flex min-h-11 items-center gap-2 border px-3 text-[0.9375rem] font-medium whitespace-nowrap',
                  'aria-[current=page]:border-brand aria-[current=page]:bg-brand-soft aria-[current=page]:text-brand-ink aria-[current=page]:font-semibold',
                )}
              >
                {item.step ? (
                  <>
                    <span
                      aria-hidden="true"
                      className="bg-surface-sunken text-ink grid size-6 place-items-center rounded-full text-xs font-semibold tabular-nums"
                    >
                      {item.step}
                    </span>
                    <span className="sr-only">Étape {item.step} : </span>
                  </>
                ) : null}
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

const STEPS = [
  { href: cleaningPaths.catalog.home, label: CATALOG_HOME_LABEL },
  ...CATALOG_STEPS.map((step, index) => ({ href: step.href, label: step.label, step: index + 1 })),
];

/** Étapes du catalogue, numérotées dans l'ordre de construction, après la vue d'ensemble. */
export function CatalogSteps() {
  return <SectionNav label={CATALOG_STEPS_LABEL} items={STEPS} rootHref={cleaningPaths.catalog.home} />;
}

/** Sections des réglages : généraux, zones desservies, jours fériés. */
export function SettingsNav() {
  return (
    <SectionNav
      label={SETTINGS_SECTIONS_LABEL}
      items={SETTINGS_SECTIONS}
      rootHref={cleaningPaths.settings.general}
    />
  );
}

/** Sections de l'onglet « Agents et équipes » : agents (et leurs fiches), équipes. */
export function TeamNav() {
  return <SectionNav label={TEAM_SECTIONS_LABEL} items={TEAM_SECTIONS} rootHref={cleaningPaths.team} />;
}
