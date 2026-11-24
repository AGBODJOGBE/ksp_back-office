import type { Metadata } from 'next';
import { ComingSoon, cleaningTexts } from '@/features/cleaning';

const t = cleaningTexts.placeholders.programs;

export const metadata: Metadata = { title: t.title };

/** Programmes (sous-lot 1c) : page provisoire. */
export default function CleaningProgramsPage() {
  return <ComingSoon title={t.title} lead={t.lead} coming={t.coming} />;
}
