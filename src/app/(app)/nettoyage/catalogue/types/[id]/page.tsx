import { Suspense } from 'react';
import { CleaningTypeDetail } from '@/features/cleaning';

/** Fiche d'un type de nettoyage (rendue à la demande ; les données sont lues par le navigateur). */
export default async function CleaningTypePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <CleaningTypeDetail id={id} />
    </Suspense>
  );
}
