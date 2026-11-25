import type { Metadata } from 'next';
import { TeamDetail, teamsTexts } from '@/features/cleaning';

export const metadata: Metadata = { title: teamsTexts.detail.title };

/** Fiche équipe (rendue à la demande ; les données sont lues par le navigateur). */
export default async function CleaningTeamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TeamDetail id={id} />;
}
