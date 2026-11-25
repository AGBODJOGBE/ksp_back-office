import type { Metadata } from 'next';
import { AgentDetail, agentsTexts } from '@/features/cleaning';

export const metadata: Metadata = { title: agentsTexts.detail.title };

/** Fiche agent (rendue à la demande ; les données sont lues par le navigateur). */
export default async function CleaningAgentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AgentDetail id={id} />;
}
