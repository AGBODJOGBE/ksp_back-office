import type { Metadata } from 'next';
import { Heading } from '@/components/ui/heading';
import { CatalogScreen, catalogTexts } from '@/features/cleaning';

export const metadata: Metadata = { title: catalogTexts.title };

export default function CleaningCatalogPage() {
  return (
    <div className="grid gap-6">
      <div>
        <Heading as="h1" size="h2">
          {catalogTexts.title}
        </Heading>
        <p className="text-ink-muted max-w-reading mt-2">{catalogTexts.lead}</p>
      </div>
      <CatalogScreen />
    </div>
  );
}
