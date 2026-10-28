import type { Metadata } from 'next';
import { Heading } from '@/components/ui/heading';
import { TeamScreen, teamTexts } from '@/features/cleaning';

export const metadata: Metadata = { title: teamTexts.title };

export default function CleaningTeamPage() {
  return (
    <div className="grid gap-6">
      <div>
        <Heading as="h1" size="h2">
          {teamTexts.title}
        </Heading>
        <p className="text-ink-muted max-w-reading mt-2">{teamTexts.lead}</p>
      </div>
      <TeamScreen />
    </div>
  );
}
