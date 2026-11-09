'use client';

import { SubNav, type SubNavItem } from '@/components/ui/sub-nav';
import { useSession } from '@/lib/api';
import { type BillingAccess, billingAccess, billingPaths } from '@/features/billing';
import { type PaymentAccess, paymentAccess, paymentPaths } from '@/features/payment';
import { type WalletAccess, walletAccess, walletPaths } from '@/features/wallet';

/**
 * Onglets du module Finance, qui assemble trois fonctionnalités (billing, payment et wallet, une par
 * service) : filtrés par les rôles de la session, affichage seulement.
 */
export function financeTabs(
  billing: BillingAccess,
  payment: PaymentAccess,
  wallet: WalletAccess,
): SubNavItem[] {
  const tabs: Array<SubNavItem & { show: boolean }> = [
    { href: billingPaths.invoices, label: 'Factures', show: billing.invoices },
    { href: paymentPaths.list, label: 'Paiements en ligne', show: payment.list },
    { href: walletPaths.overview, label: 'Portefeuilles', show: wallet.wallets },
    { href: paymentPaths.payouts, label: 'Reversements', show: payment.payouts },
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
      items={financeTabs(
        billingAccess(current.roles),
        paymentAccess(current.roles),
        walletAccess(current.roles),
      )}
    />
  );
}
