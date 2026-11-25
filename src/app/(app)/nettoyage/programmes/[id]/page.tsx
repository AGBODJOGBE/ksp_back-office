import type { Metadata } from 'next';
import { ComingSoon, cleaningPaths, cleaningTexts } from '@/features/cleaning';

const t = cleaningTexts.placeholders.program;

export const metadata: Metadata = { title: t.title };

/** Fiche d'un programme (sous-lot 1c) : page provisoire, ouverte depuis la fiche dossier. */
export default function CleaningProgramPage() {
  return (
    <ComingSoon
      title={t.title}
      lead={t.lead}
      coming={t.coming}
      back={{ href: cleaningPaths.requests, label: t.back }}
    />
  );
}
