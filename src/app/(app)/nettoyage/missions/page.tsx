import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Heading } from '@/components/ui/heading';
import { MissionsList, missionsTexts } from '@/features/cleaning';

export const metadata: Metadata = { title: missionsTexts.title };

export default function CleaningMissionsPage() {
  return (
    <div className="grid gap-6">
      <div>
        <Heading as="h1" size="h2">
          {missionsTexts.title}
        </Heading>
        <p className="text-ink-muted max-w-reading mt-2">{missionsTexts.lead}</p>
      </div>
      <Suspense>
        <MissionsList />
      </Suspense>
    </div>
  );
}
