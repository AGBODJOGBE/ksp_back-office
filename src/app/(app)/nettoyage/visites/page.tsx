import type { Metadata } from 'next';
import { ComingSoon, cleaningTexts } from '@/features/cleaning';

const t = cleaningTexts.placeholders.visits;

export const metadata: Metadata = { title: t.title };

/** Visites (sous-lot 1b) : page provisoire. */
export default function CleaningVisitsPage() {
  return <ComingSoon title={t.title} lead={t.lead} coming={t.coming} />;
}
