import { RequestDetail } from '@/features/cleaning';

/** Fiche d'une demande de devis (rendue à la demande ; les données sont lues par le navigateur). */
export default async function CleaningRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RequestDetail id={id} />;
}
