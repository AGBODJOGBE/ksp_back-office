'use client';

import { SubNav, type SubNavItem } from '@/components/ui/sub-nav';
// Magasin de session seul : la coque du module ne charge ni zod ni le client de la gateway.
import { useSession } from '@/lib/api/session';
import { type RecoveryAccess, recoveryAccess } from '@/features/recovery/access';
import { recoveryPaths } from '@/features/recovery/paths';
import { recoveryTexts } from '@/features/recovery/texts';

const t = recoveryTexts.tabs;

/**
 * Onglets du module, dans l'ordre du métier : suivre (tableau de bord), traiter les dossiers, valider
 * l'argent reçu hors ligne, régler les prix, suivre les factures de commission, régler le module.
 * Chaque onglet suit les rôles de la route qui l'alimente (affichage seulement).
 */
export function tabsFor(access: RecoveryAccess): SubNavItem[] {
  const tabs: Array<SubNavItem & { show: boolean }> = [
    { href: recoveryPaths.home, label: t.overview, show: access.overview },
    { href: recoveryPaths.cases, label: t.cases, show: access.cases },
    { href: recoveryPaths.offlinePayments, label: t.offlinePayments, show: access.offlinePayments },
    { href: recoveryPaths.pricing, label: t.pricing, show: access.pricingRead },
    { href: recoveryPaths.invoices, label: t.invoices, show: access.commissionInvoices },
    {
      // Sans les réglages (chargé, juriste…), l'onglet mène aux jours fériés, seuls lisibles.
      href: access.settings ? recoveryPaths.settings : recoveryPaths.holidays,
      label: t.settings,
      match: [recoveryPaths.settings],
      show: access.settings || access.holidaysRead,
    },
  ];
  return tabs.filter((tab) => tab.show).map(({ show: _show, ...tab }) => tab);
}

export function RecoveryTabs() {
  const current = useSession();
  if (!current) return <div className="border-line -mx-gutter min-h-11 border-b" aria-hidden="true" />;
  return <SubNav label={t.label} items={tabsFor(recoveryAccess(current))} rootHref={recoveryPaths.home} />;
}
