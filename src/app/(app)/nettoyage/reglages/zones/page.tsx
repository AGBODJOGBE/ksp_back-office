import type { Metadata } from 'next';
import { Heading } from '@/components/ui/heading';
import { settingsTexts, ZonesScreen } from '@/features/cleaning';

export const metadata: Metadata = { title: settingsTexts.zones.title };

/** Zones desservies et référentiel des communes. */
export default function CleaningZonesPage() {
  return (
    <div className="grid gap-6">
      <div>
        <Heading as="h1" size="h2">
          {settingsTexts.zones.title}
        </Heading>
        <p className="text-ink-muted max-w-reading mt-2">{settingsTexts.zones.lead}</p>
      </div>
      <ZonesScreen />
    </div>
  );
}
