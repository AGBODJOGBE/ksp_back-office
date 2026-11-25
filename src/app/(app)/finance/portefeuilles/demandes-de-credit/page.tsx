import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Heading } from '@/components/ui/heading';
import { CreditRequestsList, creditRequestTexts } from '@/features/wallet';
import { WalletNav } from '@/app/(app)/finance/portefeuilles/wallet-nav';

export const metadata: Metadata = { title: creditRequestTexts.title };

/** Demandes de crédit manuel à valider (ADR-048) : coque statique ; les filtres sont lus dans l'adresse sous Suspense. */
export default function CreditRequestsPage() {
  return (
    <div className="grid gap-6">
      <WalletNav />
      <div>
        <Heading as="h1" size="h2">
          {creditRequestTexts.title}
        </Heading>
        <p className="text-ink-muted max-w-reading mt-2">{creditRequestTexts.lead}</p>
      </div>
      <Suspense>
        <CreditRequestsList />
      </Suspense>
    </div>
  );
}
