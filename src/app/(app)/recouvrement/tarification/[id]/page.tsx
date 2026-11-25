import type { Metadata } from 'next';
import { pricingTexts, RuleDetail } from '@/features/recovery';

export const metadata: Metadata = { title: pricingTexts.detail.title };

/** Fiche d'une règle (rendue à la demande ; les données sont lues par le navigateur). */
export default async function RecoveryRulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RuleDetail id={id} />;
}
