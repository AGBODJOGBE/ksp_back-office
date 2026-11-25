import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Heading } from '@/components/ui/heading';
import { VisitsCalendar, visitsTexts } from '@/features/cleaning';

const t = visitsTexts;

export const metadata: Metadata = { title: t.title };

/** Calendrier des visites : vue, jour et filtres lus dans l'adresse sous Suspense. */
export default function CleaningVisitsPage() {
  return (
    <div className="grid gap-6">
      <div>
        <Heading as="h1" size="h2">
          {t.title}
        </Heading>
        <p className="text-ink-muted max-w-reading mt-2">{t.lead}</p>
      </div>
      <Suspense>
        <VisitsCalendar />
      </Suspense>
    </div>
  );
}
