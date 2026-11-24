import type { Metadata } from 'next';
import { ComingSoon, cleaningTexts } from '@/features/cleaning';

const t = cleaningTexts.placeholders.planning;

export const metadata: Metadata = { title: t.title };

/** Planning (sous-lot 1c) : page provisoire. */
export default function CleaningPlanningPage() {
  return <ComingSoon title={t.title} lead={t.lead} coming={t.coming} />;
}
