import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Heading } from '@/components/ui/heading';
import { PlanningScreen, planningTexts } from '@/features/cleaning';

const t = planningTexts;

export const metadata: Metadata = { title: t.title };

/** Planning : vue, jour et filtres lus dans l'adresse sous Suspense. */
export default function CleaningPlanningPage() {
  return (
    <div className="grid gap-6">
      <div>
        <Heading as="h1" size="h2">
          {t.title}
        </Heading>
        <p className="text-ink-muted max-w-reading mt-2">{t.lead}</p>
      </div>
      <Suspense>
        <PlanningScreen />
      </Suspense>
    </div>
  );
}
