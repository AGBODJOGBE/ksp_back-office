import { MissionDetail } from '@/features/cleaning';

/** Fiche d'une mission (rendue à la demande ; les données sont lues par le navigateur). */
export default async function CleaningMissionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MissionDetail id={id} />;
}
