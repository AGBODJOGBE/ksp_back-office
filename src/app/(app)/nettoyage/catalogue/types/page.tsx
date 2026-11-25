import type { Metadata } from 'next';
import { Heading } from '@/components/ui/heading';
import { catalogTexts, CleaningTypesList } from '@/features/cleaning';

export const metadata: Metadata = { title: catalogTexts.types.title };

/** Étape 5 : types de nettoyage et packs. */
export default function CleaningTypesPage() {
  return (
    <div className="grid gap-6">
      <div>
        <Heading as="h1" size="h2">
          {catalogTexts.types.title}
        </Heading>
        <p className="text-ink-muted max-w-reading mt-2">{catalogTexts.types.lead}</p>
      </div>
      <CleaningTypesList />
    </div>
  );
}
