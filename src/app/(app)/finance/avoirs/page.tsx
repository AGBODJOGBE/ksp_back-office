import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Heading } from '@/components/ui/heading';
import { CreditNotesList, creditNoteTexts } from '@/features/billing';

export const metadata: Metadata = { title: creditNoteTexts.list.title };

/** Avoirs émis (R-PE-07) : coque statique ; les filtres sont lus dans l'adresse sous Suspense. */
export default function CreditNotesPage() {
  return (
    <div className="grid gap-6">
      <div>
        <Heading as="h1" size="h2">
          {creditNoteTexts.list.title}
        </Heading>
        <p className="text-ink-muted max-w-reading mt-2">{creditNoteTexts.list.lead}</p>
      </div>
      <Suspense>
        <CreditNotesList />
      </Suspense>
    </div>
  );
}
