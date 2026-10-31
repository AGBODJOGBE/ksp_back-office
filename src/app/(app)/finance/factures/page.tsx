import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Heading } from '@/components/ui/heading';
import { billingTexts, InvoicesList } from '@/features/billing';

export const metadata: Metadata = { title: billingTexts.invoices.title };

/** Factures : coque statique ; les filtres sont lus dans l'adresse sous Suspense. */
export default function InvoicesPage() {
  return (
    <div className="grid gap-6">
      <div>
        <Heading as="h1" size="h2">
          {billingTexts.invoices.title}
        </Heading>
        <p className="text-ink-muted max-w-reading mt-2">{billingTexts.invoices.lead}</p>
      </div>
      <Suspense>
        <InvoicesList />
      </Suspense>
    </div>
  );
}
