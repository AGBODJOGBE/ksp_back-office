import type { Metadata } from 'next';
import { Heading } from '@/components/ui/heading';
import { catalogTexts, CategoriesList } from '@/features/cleaning';

export const metadata: Metadata = { title: catalogTexts.categories.title };

/** Étape 2 : catégories de lieu. */
export default function CleaningCategoriesPage() {
  return (
    <div className="grid gap-6">
      <div>
        <Heading as="h1" size="h2">
          {catalogTexts.categories.title}
        </Heading>
        <p className="text-ink-muted max-w-reading mt-2">{catalogTexts.categories.lead}</p>
      </div>
      <CategoriesList />
    </div>
  );
}
