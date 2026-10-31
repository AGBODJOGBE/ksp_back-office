import { InvoiceDetail } from '@/features/billing';

/** Fiche d'une facture (rendue à la demande ; les données sont lues par le navigateur). */
export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <InvoiceDetail id={id} />;
}
