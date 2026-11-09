import { DeliveryDetail } from '@/features/notification';

/** Détail d'un envoi (rendu à la demande ; les données sont lues par le navigateur). */
export default async function DeliveryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DeliveryDetail id={id} />;
}
