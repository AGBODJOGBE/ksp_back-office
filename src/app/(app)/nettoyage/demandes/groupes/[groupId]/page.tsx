import type { Metadata } from 'next';
import { GroupDetail, groupTexts } from '@/features/cleaning';

export const metadata: Metadata = { title: groupTexts.title };

/** Vue d'un groupe de demandes (rendue à la demande ; les données sont lues par le navigateur). */
export default async function CleaningRequestGroupPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  return <GroupDetail groupId={groupId} />;
}
