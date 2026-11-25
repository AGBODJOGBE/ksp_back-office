import type { Metadata } from 'next';
import { Heading } from '@/components/ui/heading';
import { catalogTexts, SkillsScreen } from '@/features/cleaning';

export const metadata: Metadata = { title: catalogTexts.skills.title };

/** Étape 4 : compétences des agents. */
export default function CleaningSkillsPage() {
  return (
    <div className="grid gap-6">
      <div>
        <Heading as="h1" size="h2">
          {catalogTexts.skills.title}
        </Heading>
        <p className="text-ink-muted max-w-reading mt-2">{catalogTexts.skills.lead}</p>
      </div>
      <SkillsScreen />
    </div>
  );
}
