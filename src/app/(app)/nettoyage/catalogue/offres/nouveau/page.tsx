import type { Metadata } from 'next';
import { Suspense } from 'react';
import { catalogTexts, NewOffer } from '@/features/cleaning';

export const metadata: Metadata = { title: catalogTexts.offers.newTitle };

/** Création d'une offre (lieu prérempli par l'adresse). */
export default function NewCleaningOfferPage() {
  return (
    <Suspense>
      <NewOffer />
    </Suspense>
  );
}
