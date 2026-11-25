import type { Metadata } from 'next';
import { Heading } from '@/components/ui/heading';
import { SettingsScreen, settingsTexts } from '@/features/cleaning';

export const metadata: Metadata = { title: settingsTexts.title };

/** Réglages généraux du module. */
export default function CleaningSettingsPage() {
  return (
    <div className="grid gap-6">
      <div>
        <Heading as="h1" size="h2">
          {settingsTexts.title}
        </Heading>
        <p className="text-ink-muted max-w-reading mt-2">{settingsTexts.lead}</p>
      </div>
      <SettingsScreen />
    </div>
  );
}
