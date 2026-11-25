import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Heading } from '@/components/ui/heading';
import { ProgramsList, programsTexts } from '@/features/cleaning';

const t = programsTexts.list;

export const metadata: Metadata = { title: t.title };

/** Programmes : filtres lus dans l'adresse sous Suspense ; données lues par le navigateur. */
export default function CleaningProgramsPage() {
  return (
    <div className="grid gap-6">
      <div>
        <Heading as="h1" size="h2">
          {t.title}
        </Heading>
        <p className="text-ink-muted max-w-reading mt-2">{t.lead}</p>
      </div>
      <Suspense>
        <ProgramsList />
      </Suspense>
    </div>
  );
}
