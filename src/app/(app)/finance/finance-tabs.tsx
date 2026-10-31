'use client';

import { SubNav, type SubNavItem } from '@/components/ui/sub-nav';
import { useSession } from '@/lib/api';
import { type BillingAccess, billingAccess, billingPaths } from '@/features/billing';
import { type PaymentAccess, paymentAccess, paymentPaths } from '@/features/payment';

/**
 * Onglets du module Finance, qui assemble deux fonctionnalités (billing et payment, une par service) :
 * filtrés par les rôles de la session, affichage seulement.
 */
export function financeTabs(billing: BillingAccess, payment: PaymentAccess): SubNavItem[] {
  const tabs: Array<SubNavItem & { show: boolean }> = [
    { href: billingPaths.invoices, label: 'Factures', show: billing.invoices },
    { href: paymentPaths.list, label: 'Paiements en ligne', show: payment.list },
    { href: billingPaths.settings, label: 'Réglages', show: billing.settings },
  ];
  return tabs.filter((tab) => tab.show).map(({ show: _show, ...tab }) => tab);
}

export function FinanceTabs() {
  const current = useSession();
  if (!current) return <div className="border-line -mx-gutter min-h-11 border-b" aria-hidden="true" />;
  return (
    <SubNav
      label="Sections de la Finance"
      items={financeTabs(billingAccess(current.roles), paymentAccess(current.roles))}
    />
  );
}
