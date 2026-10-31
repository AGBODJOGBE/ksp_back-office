import type { ReactNode } from 'react';
import { Heading } from '@/components/ui/heading';

/** Bloc titré d'une fiche (client, lignes, règlements, membres…). À faire converger avec le portail. */
export function Panel({
  title,
  action,
  children,
  id,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section
      aria-labelledby={id}
      className="rounded-card border-line bg-surface grid min-w-0 content-start gap-4 border p-4 sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Heading as="h2" size="h3" id={id}>
          {title}
        </Heading>
        {action}
      </div>
      {children}
    </section>
  );
}
