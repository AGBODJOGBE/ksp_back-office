import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Heading } from '@/components/ui/heading';
import { pricingTexts, RulesList } from '@/features/recovery';

const t = pricingTexts.list;

export const metadata: Metadata = { title: t.title };

/** Règles tarifaires ; filtres lus dans l'adresse sous Suspense. */
export default function RecoveryPricingPage() {
  return (
    <div className="grid gap-6">
      <div>
        <Heading as="h1" size="h2">
          {t.title}
        </Heading>
        <p className="text-ink-muted max-w-reading mt-2">{t.lead}</p>
      </div>
      <Suspense>
        <RulesList />
      </Suspense>
    </div>
  );
}
