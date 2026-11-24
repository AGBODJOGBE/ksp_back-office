import type { Metadata } from 'next';
import { Suspense } from 'react';
import { catalogTexts, NewPlace } from '@/features/cleaning';

export const metadata: Metadata = { title: catalogTexts.places.newTitle };

/** Création d'un lieu (catégorie préremplie par l'adresse). */
export default function NewCleaningPlacePage() {
  return (
    <Suspense>
      <NewPlace />
    </Suspense>
  );
}
