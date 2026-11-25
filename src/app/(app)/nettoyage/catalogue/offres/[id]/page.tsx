import { Suspense } from 'react';
import { OfferDetail } from '@/features/cleaning';

/** Fiche d'une offre et de son tarif (rendue à la demande ; les données sont lues par le navigateur). */
export default async function CleaningOfferPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <OfferDetail id={id} />
    </Suspense>
  );
}
