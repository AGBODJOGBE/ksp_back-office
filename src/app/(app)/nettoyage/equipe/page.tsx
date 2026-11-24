import type { Metadata } from 'next';
import { ComingSoon, cleaningTexts } from '@/features/cleaning';

const t = cleaningTexts.placeholders.team;

export const metadata: Metadata = { title: t.title };

/** Agents et équipes (sous-lot 1c) : page provisoire. */
export default function CleaningTeamPage() {
  return <ComingSoon title={t.title} lead={t.lead} coming={t.coming} />;
}
