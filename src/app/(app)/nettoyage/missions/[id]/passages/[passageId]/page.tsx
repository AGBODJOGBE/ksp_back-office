import { InterventionScreen } from '@/features/cleaning';

/** Passage d'une mission, écran de l'agent sur le terrain (téléphone d'abord). */
export default async function CleaningInterventionPage({
  params,
}: {
  params: Promise<{ id: string; passageId: string }>;
}) {
  const { id, passageId } = await params;
  return <InterventionScreen missionId={id} interventionId={passageId} />;
}
