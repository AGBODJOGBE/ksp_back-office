import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Heading } from '@/components/ui/heading';
import { OfflinePayments, offlineTexts } from '@/features/recovery';

export const metadata: Metadata = { title: offlineTexts.title };

/** Paiements hors ligne à valider ; état lu dans l'adresse sous Suspense. */
export default function RecoveryOfflinePaymentsPage() {
  return (
    <div className="grid gap-6">
      <div>
        <Heading as="h1" size="h2">
          {offlineTexts.title}
        </Heading>
        <p className="text-ink-muted max-w-reading mt-2">{offlineTexts.lead}</p>
      </div>
      <Suspense>
        <OfflinePayments />
      </Suspense>
    </div>
  );
}
