'use client';

import { SubNav, type SubNavItem } from '@/components/ui/sub-nav';
// Magasin de session seul : la coque du module ne charge ni zod ni le client de la gateway.
import { useSession } from '@/lib/api/session';
import { type CleaningAccess, cleaningAccess } from '@/features/cleaning/access';
import { cleaningPaths } from '@/features/cleaning/paths';
import { cleaningTexts } from '@/features/cleaning/texts';

const t = cleaningTexts.tabs;

/**
 * Onglets du parcours v2, dans l'ordre du métier : construire le catalogue, traiter les dossiers et les
 * visites, planifier, suivre les programmes, gérer les agents, répondre aux réclamations, régler le
 * module. Chaque onglet suit la permission de la route qui l'alimente (affichage seulement).
 */
export function tabsFor(access: CleaningAccess): SubNavItem[] {
  const tabs: Array<SubNavItem & { show: boolean }> = [
    { href: cleaningPaths.catalog.home, label: t.catalog, show: access['cleaning.catalog.read'] },
    {
      href: cleaningPaths.requests,
      label: t.requests,
      match: [cleaningPaths.requestPrefix],
      show: access['cleaning.request.read'],
    },
    { href: cleaningPaths.visits, label: t.visits, show: access['cleaning.request.read'] },
    { href: cleaningPaths.planning, label: t.planning, show: access['cleaning.planning.manage'] },
    {
      href: cleaningPaths.programs,
      label: t.programs,
      match: [cleaningPaths.missionPrefix],
      show: access['cleaning.program.read'],
    },
    { href: cleaningPaths.team, label: t.team, show: access['cleaning.planning.manage'] },
    { href: cleaningPaths.claims, label: t.claims, show: access['cleaning.claim.manage'] },
    {
      href: cleaningPaths.settings.general,
      label: t.settings,
      show: access['cleaning.request.read'] || access['cleaning.catalog.read'],
    },
  ];
  return tabs.filter((tab) => tab.show).map(({ show: _show, ...tab }) => tab);
}

export function CleaningTabs() {
  const current = useSession();
  if (!current) return <div className="border-line -mx-gutter min-h-11 border-b" aria-hidden="true" />;
  return (
    <SubNav
      label={t.label}
      items={tabsFor(cleaningAccess(current.roles))}
      rootHref={cleaningPaths.requests}
    />
  );
}
