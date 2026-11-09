import type { Metadata } from 'next';
import { Heading } from '@/components/ui/heading';
import { AccountsSearch, accountTexts } from '@/features/identity/accounts';

export const metadata: Metadata = { title: accountTexts.list.title };

/** Comptes et rôles : coque statique ; la recherche et la liste sont lues par le navigateur. */
export default function AccountsPage() {
  return (
    <div className="grid gap-6">
      <div>
        <Heading as="h1" size="h2">
          {accountTexts.list.title}
        </Heading>
        <p className="text-ink-muted max-w-reading mt-2">{accountTexts.list.lead}</p>
      </div>
      <AccountsSearch />
    </div>
  );
}
