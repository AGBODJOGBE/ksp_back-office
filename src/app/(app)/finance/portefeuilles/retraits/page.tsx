import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Heading } from '@/components/ui/heading';
import { WithdrawalsList, withdrawalTexts } from '@/features/wallet';
import { WalletNav } from '@/app/(app)/finance/portefeuilles/wallet-nav';

export const metadata: Metadata = { title: withdrawalTexts.title };

/** Retraits du portefeuille prépayé vers Mobile Money (R-WL-04) : coque statique ; les filtres sont lus dans l'adresse sous Suspense. */
export default function WithdrawalsPage() {
  return (
    <div className="grid gap-6">
      <WalletNav />
      <div>
        <Heading as="h1" size="h2">
          {withdrawalTexts.title}
        </Heading>
        <p className="text-ink-muted max-w-reading mt-2">{withdrawalTexts.lead}</p>
      </div>
      <Suspense>
        <WithdrawalsList />
      </Suspense>
    </div>
  );
}
