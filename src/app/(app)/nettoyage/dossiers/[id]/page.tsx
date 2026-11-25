import type { Metadata } from 'next';
import { Suspense } from 'react';
import { RequestDetail, requestsTexts } from '@/features/cleaning';

export const metadata: Metadata = { title: requestsTexts.detail.title };

/** Fiche dossier par étapes (rendue à la demande ; les données sont lues par le navigateur). */
export default async function CleaningRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <RequestDetail id={id} />
    </Suspense>
  );
}
