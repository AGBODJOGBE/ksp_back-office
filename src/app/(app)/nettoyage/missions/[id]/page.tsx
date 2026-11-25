import type { Metadata } from 'next';
import { cleaningTexts, LegacyMission } from '@/features/cleaning';

export const metadata: Metadata = { title: cleaningTexts.legacyMission.title };

/**
 * Ancienne fiche « mission » (v1), encore citée par les factures, les paiements et les portefeuilles :
 * aucune correspondance avec un programme v2 dans le contrat, donc pas de redirection (à valider).
 */
export default async function CleaningMissionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LegacyMission id={id} />;
}
