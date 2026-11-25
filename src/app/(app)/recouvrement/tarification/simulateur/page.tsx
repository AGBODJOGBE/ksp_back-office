import type { Metadata } from 'next';
import { Heading } from '@/components/ui/heading';
import { PricingSimulator, simulatorTexts } from '@/features/recovery';

export const metadata: Metadata = { title: simulatorTexts.title };

/** Simulateur : règle publiée applicable à une cible, sur un exemple. */
export default function RecoverySimulatorPage() {
  return (
    <div className="grid gap-6">
      <div>
        <Heading as="h1" size="h2">
          {simulatorTexts.title}
        </Heading>
        <p className="text-ink-muted max-w-reading mt-2">{simulatorTexts.lead}</p>
      </div>
      <PricingSimulator />
    </div>
  );
}
