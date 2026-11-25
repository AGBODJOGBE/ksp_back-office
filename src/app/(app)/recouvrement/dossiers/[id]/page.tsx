import type { Metadata } from 'next';
import { CaseDetail, caseListTexts } from '@/features/recovery';

export const metadata: Metadata = { title: caseListTexts.title };

/** Fiche d'un dossier (rendue à la demande ; les données sont lues par le navigateur). */
export default async function RecoveryCasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CaseDetail id={id} />;
}
