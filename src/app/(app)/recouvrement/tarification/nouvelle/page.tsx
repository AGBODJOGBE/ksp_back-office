import type { Metadata } from 'next';
import { Suspense } from 'react';
import { NewRule, pricingTexts } from '@/features/recovery';

export const metadata: Metadata = { title: pricingTexts.list.create };

/** Nouvelle règle (brouillon) ou nouvelle version (`?version-de=`, lu sous Suspense). */
export default function RecoveryNewRulePage() {
  return (
    <Suspense>
      <NewRule />
    </Suspense>
  );
}
