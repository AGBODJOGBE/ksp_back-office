import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Heading } from '@/components/ui/heading';
import { DeliveriesList, notificationTexts } from '@/features/notification';

const t = notificationTexts.deliveries;

export const metadata: Metadata = { title: t.title };

/** Historique des envois : coque statique ; les filtres sont lus dans l'adresse sous Suspense. */
export default function DeliveriesPage() {
  return (
    <div className="grid gap-6">
      <div>
        <Heading as="h1" size="h2">
          {t.title}
        </Heading>
        <p className="text-ink-muted max-w-reading mt-2">{t.lead}</p>
      </div>
      <Suspense>
        <DeliveriesList />
      </Suspense>
    </div>
  );
}
