import type { Metadata } from 'next';
import { Suspense } from 'react';
import { catalogTexts, NewCategory } from '@/features/cleaning';

export const metadata: Metadata = { title: catalogTexts.categories.newTitle };

/** Création d'une catégorie de lieu. */
export default function NewCleaningCategoryPage() {
  return (
    <Suspense>
      <NewCategory />
    </Suspense>
  );
}
