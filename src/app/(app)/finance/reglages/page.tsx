import type { Metadata } from 'next';
import { Heading } from '@/components/ui/heading';
import { BillingSettingsScreen, billingTexts } from '@/features/billing';

export const metadata: Metadata = { title: billingTexts.settings.title };

export default function BillingSettingsPage() {
  return (
    <div className="grid gap-6">
      <div>
        <Heading as="h1" size="h2">
          {billingTexts.settings.title}
        </Heading>
        <p className="text-ink-muted max-w-reading mt-2">{billingTexts.settings.lead}</p>
      </div>
      <BillingSettingsScreen />
    </div>
  );
}
