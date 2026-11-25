import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Heading } from '@/components/ui/heading';
import { agentsTexts, TeamsList } from '@/features/cleaning';

const title = agentsTexts.sections.teams;

export const metadata: Metadata = { title };

/** Équipes : filtre d'état lu dans l'adresse sous Suspense. */
export default function CleaningTeamsPage() {
  return (
    <div className="grid gap-6">
      <Heading as="h1" size="h2">
        {title}
      </Heading>
      <Suspense>
        <TeamsList />
      </Suspense>
    </div>
  );
}
