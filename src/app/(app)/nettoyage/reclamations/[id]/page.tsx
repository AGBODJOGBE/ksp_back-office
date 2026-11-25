import type { Metadata } from 'next';
import { ClaimDetail, claimsTexts } from '@/features/cleaning';

export const metadata: Metadata = { title: claimsTexts.detail.title };

/** Fiche d'une réclamation (rendue à la demande ; les données sont lues par le navigateur). */
export default async function CleaningClaimPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ClaimDetail id={id} />;
}
