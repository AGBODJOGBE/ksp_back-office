import type { Metadata } from 'next';
import { programsTexts, SessionDetail } from '@/features/cleaning';

export const metadata: Metadata = { title: programsTexts.session.title };

/** Détail d'une séance d'un programme (rendu à la demande ; données lues par le navigateur). */
export default async function CleaningSessionPage({
  params,
}: {
  params: Promise<{ id: string; sessionId: string }>;
}) {
  const { id, sessionId } = await params;
  return <SessionDetail programId={id} sessionId={sessionId} />;
}
