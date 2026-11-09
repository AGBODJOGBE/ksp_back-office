import type { Metadata } from 'next';
import { Heading } from '@/components/ui/heading';
import { walletTexts, WalletsOverview } from '@/features/wallet';

export const metadata: Metadata = { title: walletTexts.title };

/** Portefeuilles : coque statique ; vue d'ensemble et recherche lues par le navigateur. */
export default function WalletsPage() {
  return (
    <div className="grid gap-6">
      <div>
        <Heading as="h1" size="h2">
          {walletTexts.title}
        </Heading>
        <p className="text-ink-muted max-w-reading mt-2">{walletTexts.lead}</p>
      </div>
      <WalletsOverview />
    </div>
  );
}
