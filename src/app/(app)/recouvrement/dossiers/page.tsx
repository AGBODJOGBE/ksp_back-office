import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Heading } from '@/components/ui/heading';
import { caseListTexts, CasesList } from '@/features/recovery';

export const metadata: Metadata = { title: caseListTexts.title };

/** File des dossiers ; filtres lus dans l'adresse sous Suspense. */
export default function RecoveryCasesPage() {
  return (
    <div className="grid gap-6">
      <div>
        <Heading as="h1" size="h2">
          {caseListTexts.title}
        </Heading>
        <p className="text-ink-muted max-w-reading mt-2">{caseListTexts.lead}</p>
      </div>
      <Suspense>
        <CasesList />
      </Suspense>
    </div>
  );
}
