import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Heading } from '@/components/ui/heading';
import { PaymentsList, paymentTexts } from '@/features/payment';

export const metadata: Metadata = { title: paymentTexts.title };

/** Paiements en ligne : coque statique ; les filtres sont lus dans l'adresse sous Suspense. */
export default function PaymentsPage() {
  return (
    <div className="grid gap-6">
      <div>
        <Heading as="h1" size="h2">
          {paymentTexts.title}
        </Heading>
        <p className="text-ink-muted max-w-reading mt-2">{paymentTexts.lead}</p>
      </div>
      <Suspense>
        <PaymentsList />
      </Suspense>
    </div>
  );
}
