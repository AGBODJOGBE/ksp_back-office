import { Suspense } from 'react';
import { CategoryDetail } from '@/features/cleaning';

/** Fiche d'une catégorie de lieu (rendue à la demande ; les données sont lues par le navigateur). */
export default async function CleaningCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <CategoryDetail id={id} />
    </Suspense>
  );
}
