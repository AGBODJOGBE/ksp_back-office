import type { Metadata } from 'next';
import { ComingSoon, cleaningTexts } from '@/features/cleaning';

const t = cleaningTexts.placeholders.claims;

export const metadata: Metadata = { title: t.title };

/** Réclamations (sous-lot 1c) : page provisoire. */
export default function CleaningClaimsPage() {
  return <ComingSoon title={t.title} lead={t.lead} coming={t.coming} />;
}
