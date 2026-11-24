import type { Metadata } from 'next';
import { ComingSoon, cleaningTexts } from '@/features/cleaning';

const t = cleaningTexts.placeholders.requests;

export const metadata: Metadata = { title: t.title };

/** Dossiers (sous-lot 1b) : page provisoire, racine du module. */
export default function CleaningRequestsPage() {
  return <ComingSoon title={t.title} lead={t.lead} coming={t.coming} />;
}
