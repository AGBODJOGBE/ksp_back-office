import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Heading } from '@/components/ui/heading';
import { PayoutsList, payoutTexts } from '@/features/payment';

export const metadata: Metadata = { title: payoutTexts.title };

/** Reversements par Mobile Money : coque statique ; le filtre est lu dans l'adresse sous Suspense. */
export default function PayoutsPage() {
  return (
    <div className="grid gap-6">
      <div>
        <Heading as="h1" size="h2">
          {payoutTexts.title}
        </Heading>
        <p className="text-ink-muted max-w-reading mt-2">{payoutTexts.lead}</p>
      </div>
      <Suspense>
        <PayoutsList />
      </Suspense>
    </div>
  );
}
