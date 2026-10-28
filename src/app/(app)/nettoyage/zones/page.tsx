import type { Metadata } from 'next';
import { Heading } from '@/components/ui/heading';
import { ZonesScreen, zonesTexts } from '@/features/cleaning';

export const metadata: Metadata = { title: zonesTexts.title };

export default function CleaningZonesPage() {
  return (
    <div className="grid gap-6">
      <div>
        <Heading as="h1" size="h2">
          {zonesTexts.title}
        </Heading>
        <p className="text-ink-muted max-w-reading mt-2">{zonesTexts.lead}</p>
      </div>
      <ZonesScreen />
    </div>
  );
}
