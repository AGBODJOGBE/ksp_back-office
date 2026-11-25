import { Suspense } from 'react';
import { PlaceDetail } from '@/features/cleaning';

/** Fiche d'un lieu (rendue à la demande ; les données sont lues par le navigateur). */
export default async function CleaningPlacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <PlaceDetail id={id} />
    </Suspense>
  );
}
