import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Heading } from '@/components/ui/heading';
import { catalogTexts, OffersList } from '@/features/cleaning';

export const metadata: Metadata = { title: catalogTexts.offers.title };

/** Étape 6 : offres et tarifs ; filtres lus dans l'adresse sous Suspense. */
export default function CleaningOffersPage() {
  return (
    <div className="grid gap-6">
      <div>
        <Heading as="h1" size="h2">
          {catalogTexts.offers.title}
        </Heading>
        <p className="text-ink-muted max-w-reading mt-2">{catalogTexts.offers.lead}</p>
      </div>
      <Suspense>
        <OffersList />
      </Suspense>
    </div>
  );
}
