import { Suspense } from 'react';
import { ParameterDetail } from '@/features/cleaning';

/** Fiche d'un paramètre (rendue à la demande ; les données sont lues par le navigateur). */
export default async function CleaningParameterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <ParameterDetail id={id} />
    </Suspense>
  );
}
