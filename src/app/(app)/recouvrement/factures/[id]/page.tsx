import type { Metadata } from 'next';
import { CommissionInvoiceDetail, invoiceTexts } from '@/features/recovery';

export const metadata: Metadata = { title: invoiceTexts.list.title };

/** Fiche d'une facture de commission (rendue à la demande ; les données sont lues par le navigateur). */
export default async function RecoveryInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CommissionInvoiceDetail id={id} />;
}
