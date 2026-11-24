import type { Metadata } from 'next';
import { Suspense } from 'react';
import { catalogTexts, NewCleaningType } from '@/features/cleaning';

export const metadata: Metadata = { title: catalogTexts.types.newTitle };

/** Création d'un type de nettoyage ou d'un pack. */
export default function NewCleaningTypePage() {
  return (
    <Suspense>
      <NewCleaningType />
    </Suspense>
  );
}
