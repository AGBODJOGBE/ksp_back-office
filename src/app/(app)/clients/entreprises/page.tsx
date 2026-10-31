import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Heading } from '@/components/ui/heading';
import { OrganizationsList, organizationTexts } from '@/features/identity/organizations';

export const metadata: Metadata = { title: organizationTexts.list.title };

/** Comptes entreprise : coque statique ; le filtre d'état est lu dans l'adresse sous Suspense. */
export default function OrganizationsPage() {
  return (
    <div className="grid gap-6">
      <div>
        <Heading as="h1" size="h2">
          {organizationTexts.list.title}
        </Heading>
        <p className="text-ink-muted max-w-reading mt-2">{organizationTexts.list.lead}</p>
      </div>
      <Suspense>
        <OrganizationsList />
      </Suspense>
    </div>
  );
}
