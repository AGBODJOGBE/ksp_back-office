import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Heading } from '@/components/ui/heading';
import { WalletPayoutsList, walletPayoutTexts } from '@/features/wallet';
import { WalletNav } from '@/app/(app)/finance/portefeuilles/wallet-nav';

export const metadata: Metadata = { title: walletPayoutTexts.title };

/** Reversements demandés depuis les portefeuilles : coque statique ; les filtres sont lus dans l'adresse sous Suspense. */
export default function WalletPayoutsPage() {
  return (
    <div className="grid gap-6">
      <WalletNav />
      <div>
        <Heading as="h1" size="h2">
          {walletPayoutTexts.title}
        </Heading>
        <p className="text-ink-muted max-w-reading mt-2">{walletPayoutTexts.lead}</p>
      </div>
      <Suspense>
        <WalletPayoutsList />
      </Suspense>
    </div>
  );
}
