import type { Metadata } from 'next';
import { Heading } from '@/components/ui/heading';
import { catalogTexts, ParametersList } from '@/features/cleaning';

export const metadata: Metadata = { title: catalogTexts.parameters.title };

/** Étape 1 : paramètres demandés au client. */
export default function CleaningParametersPage() {
  return (
    <div className="grid gap-6">
      <div>
        <Heading as="h1" size="h2">
          {catalogTexts.parameters.title}
        </Heading>
        <p className="text-ink-muted max-w-reading mt-2">{catalogTexts.parameters.lead}</p>
      </div>
      <ParametersList />
    </div>
  );
}
