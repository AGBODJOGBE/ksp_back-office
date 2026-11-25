import type { Metadata } from 'next';
import { Suspense } from 'react';
import { catalogTexts, NewParameter } from '@/features/cleaning';

export const metadata: Metadata = { title: catalogTexts.parameters.newTitle };

/** Création d'un paramètre. */
export default function NewCleaningParameterPage() {
  return (
    <Suspense>
      <NewParameter />
    </Suspense>
  );
}
