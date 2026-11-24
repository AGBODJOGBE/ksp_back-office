import type { Metadata } from 'next';
import { ComingSoon, cleaningTexts } from '@/features/cleaning';

const t = cleaningTexts.placeholders.mission;

export const metadata: Metadata = { title: t.title };

/**
 * Ancienne fiche « mission » (v1), encore citée par les factures, les paiements et les portefeuilles :
 * page provisoire jusqu'aux écrans des programmes (sous-lot 1c), qui décideront de sa redirection.
 */
export default function CleaningMissionPage() {
  return <ComingSoon title={t.title} lead={t.lead} coming={t.coming} />;
}
