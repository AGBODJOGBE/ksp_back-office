import type { Metadata } from 'next';
import { ProgramDetail, programsTexts } from '@/features/cleaning';

export const metadata: Metadata = { title: programsTexts.detail.title };

/** Fiche d'un programme (rendue à la demande ; les données sont lues par le navigateur). */
export default async function CleaningProgramPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProgramDetail id={id} />;
}
