import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Heading } from '@/components/ui/heading';
import { RequestsQueue, requestsTexts } from '@/features/cleaning';

const t = requestsTexts.queue;

export const metadata: Metadata = { title: t.title };

/** Dossiers : file des demandes, racine du module ; filtres lus dans l'adresse sous Suspense. */
export default function CleaningRequestsPage() {
  return (
    <div className="grid gap-6">
      <div>
        <Heading as="h1" size="h2">
          {t.title}
        </Heading>
        <p className="text-ink-muted max-w-reading mt-2">{t.lead}</p>
      </div>
      <Suspense>
        <RequestsQueue />
      </Suspense>
    </div>
  );
}
