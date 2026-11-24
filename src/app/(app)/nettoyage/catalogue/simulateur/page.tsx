import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Heading } from '@/components/ui/heading';
import { Simulator, simulatorTexts } from '@/features/cleaning';

export const metadata: Metadata = { title: simulatorTexts.title };

/** Étape 7 : simulateur, prérempli par l'adresse (lieu, types, brouillons) sous Suspense. */
export default function CleaningSimulatorPage() {
  return (
    <div className="grid gap-6">
      <div>
        <Heading as="h1" size="h2">
          {simulatorTexts.title}
        </Heading>
        <p className="text-ink-muted max-w-reading mt-2">{simulatorTexts.lead}</p>
      </div>
      <Suspense>
        <Simulator />
      </Suspense>
    </div>
  );
}
