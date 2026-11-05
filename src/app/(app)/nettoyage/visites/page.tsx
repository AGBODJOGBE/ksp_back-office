import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Heading } from '@/components/ui/heading';
import { VisitsList, visitsTexts } from '@/features/cleaning';

export const metadata: Metadata = { title: visitsTexts.title };

/** Visites techniques : coque statique ; les filtres sont lus dans l'adresse sous Suspense. */
export default function CleaningVisitsPage() {
  return (
    <div className="grid gap-6">
      <div>
        <Heading as="h1" size="h2">
          {visitsTexts.title}
        </Heading>
        <p className="text-ink-muted max-w-reading mt-2">{visitsTexts.lead}</p>
      </div>
      <Suspense>
        <VisitsList />
      </Suspense>
    </div>
  );
}
