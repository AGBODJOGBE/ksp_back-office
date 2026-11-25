import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Heading } from '@/components/ui/heading';
import { HolidaysScreen, settingsTexts } from '@/features/recovery';

export const metadata: Metadata = { title: settingsTexts.holidays.title };

/** Jours fériés ; année lue dans l'adresse sous Suspense. */
export default function RecoveryHolidaysPage() {
  return (
    <div className="grid gap-6">
      <div>
        <Heading as="h1" size="h2">
          {settingsTexts.holidays.title}
        </Heading>
        <p className="text-ink-muted max-w-reading mt-2">{settingsTexts.holidays.lead}</p>
      </div>
      <Suspense>
        <HolidaysScreen />
      </Suspense>
    </div>
  );
}
