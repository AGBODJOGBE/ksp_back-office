import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Heading } from '@/components/ui/heading';
import { catalogTexts, PlacesList } from '@/features/cleaning';

export const metadata: Metadata = { title: catalogTexts.places.title };

/** Étape 3 : lieux ; filtre de catégorie lu dans l'adresse sous Suspense. */
export default function CleaningPlacesPage() {
  return (
    <div className="grid gap-6">
      <div>
        <Heading as="h1" size="h2">
          {catalogTexts.places.title}
        </Heading>
        <p className="text-ink-muted max-w-reading mt-2">{catalogTexts.places.lead}</p>
      </div>
      <Suspense>
        <PlacesList />
      </Suspense>
    </div>
  );
}
