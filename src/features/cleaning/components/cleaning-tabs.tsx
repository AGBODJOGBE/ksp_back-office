'use client';

import { SubNav, type SubNavItem } from '@/components/ui/sub-nav';
import type { CleaningAccess } from '@/features/cleaning/access';
import { cleaningPaths } from '@/features/cleaning/paths';
import { cleaningTexts } from '@/features/cleaning/texts';
import { useCleaningAccess } from './parts';

const t = cleaningTexts.tabs;

/** Onglets du module, filtrés par les rôles de la session (affichage seulement). */
export function tabsFor(access: CleaningAccess): SubNavItem[] {
  const tabs: Array<SubNavItem & { show: boolean }> = [
    {
      href: cleaningPaths.requests,
      label: t.requests,
      match: ['/nettoyage/demandes'],
      show: access.supervise,
    },
    { href: cleaningPaths.missions, label: t.missions, show: access.fieldWork },
    { href: cleaningPaths.catalog, label: t.catalog, show: access.administer },
    { href: cleaningPaths.zones, label: t.zones, show: access.administer },
    { href: cleaningPaths.team, label: t.team, show: access.supervise },
  ];
  return tabs.filter((tab) => tab.show).map(({ show: _show, ...tab }) => tab);
}

export function CleaningTabs() {
  const access = useCleaningAccess();
  if (!access) return <div className="border-line -mx-gutter min-h-11 border-b" aria-hidden="true" />;
  return <SubNav label={t.label} items={tabsFor(access)} rootHref={cleaningPaths.requests} />;
}
