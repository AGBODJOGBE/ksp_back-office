import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Heading } from '@/components/ui/heading';
import { RequestsList, requestsTexts } from '@/features/cleaning';

export const metadata: Metadata = { title: requestsTexts.title };

/** Demandes de devis : coque statique ; les filtres sont lus dans l'adresse sous Suspense. */
export default function CleaningRequestsPage() {
  return (
    <div className="grid gap-6">
      <div>
        <Heading as="h1" size="h2">
          {requestsTexts.title}
        </Heading>
        <p className="text-ink-muted max-w-reading mt-2">{requestsTexts.lead}</p>
      </div>
      <Suspense>
        <RequestsList />
      </Suspense>
    </div>
  );
}
