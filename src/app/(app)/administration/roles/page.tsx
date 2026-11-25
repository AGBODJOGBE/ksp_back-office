import type { Metadata } from 'next';
import { Heading } from '@/components/ui/heading';
import { RolesList, roleTexts } from '@/features/identity/accounts';

export const metadata: Metadata = { title: roleTexts.list.title };

/** Rôles du back-office (ADR-057) : coque statique ; la liste est lue par le navigateur. */
export default function RolesPage() {
  return (
    <div className="grid gap-6">
      <div>
        <Heading as="h1" size="h2">
          {roleTexts.list.title}
        </Heading>
        <p className="text-ink-muted max-w-reading mt-2">{roleTexts.list.lead}</p>
      </div>
      <RolesList />
    </div>
  );
}
