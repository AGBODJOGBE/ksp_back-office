import type { Metadata } from 'next';
import { Heading } from '@/components/ui/heading';
import { Overview, overviewTexts } from '@/features/recovery';

export const metadata: Metadata = { title: overviewTexts.title };

/** Tableau de bord du recouvrement : racine du module. */
export default function RecoveryOverviewPage() {
  return (
    <div className="grid gap-6">
      <div>
        <Heading as="h1" size="h2">
          {overviewTexts.title}
        </Heading>
        <p className="text-ink-muted max-w-reading mt-2">{overviewTexts.lead}</p>
      </div>
      <Overview />
    </div>
  );
}
