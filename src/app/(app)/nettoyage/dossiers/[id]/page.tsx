import type { Metadata } from 'next';
import { ComingSoon, cleaningPaths, requestsTexts } from '@/features/cleaning';

const t = requestsTexts.detail;

export const metadata: Metadata = { title: t.title };

/** Fiche dossier (sous-lot 1b, écrans suivants) : page provisoire. */
export default function CleaningRequestPage() {
  return (
    <ComingSoon
      title={t.title}
      lead={t.lead}
      coming={t.coming}
      back={{ href: cleaningPaths.requests, label: t.back }}
    />
  );
}
