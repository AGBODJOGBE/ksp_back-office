'use client';

import { cn } from '@/lib/cn';
import { requestTexts } from '@/features/cleaning/request-detail-texts';
import type { StepState } from '@/features/cleaning/workflow';

const states = requestTexts.steps;

/**
 * Bandeau d'avancement d'un dossier : numéro (ou coche), libellé et état en texte (le sens ne repose pas sur la
 * couleur seule) ; l'étape en cours porte `aria-current="step"`. Avec `href`, chaque étape mène à sa section.
 */
export function StepBanner({
  label,
  items,
}: {
  label: string;
  items: Array<{ key: string; title: string; state: StepState; href?: string; onSelect?: () => void }>;
}) {
  return (
    <nav aria-label={label}>
      <ol className="grid grid-cols-5 gap-1 sm:gap-2">
        {items.map((item, index) => {
          const content = (
            <>
              <span
                aria-hidden="true"
                className={cn(
                  'grid size-8 place-items-center rounded-full text-sm font-semibold',
                  item.state === 'done' && 'bg-action text-on-action',
                  item.state === 'current' && 'bg-brand text-on-brand',
                  item.state === 'upcoming' && 'bg-surface-sunken text-ink-muted',
                )}
              >
                {item.state === 'done' ? '✓' : index + 1}
              </span>
              <span className="text-small text-ink font-semibold break-words">{item.title}</span>
              <span className="sr-only">, {states[item.state]}</span>
              <span aria-hidden="true" className="text-ink-muted hidden text-xs sm:block">
                {states[item.state]}
              </span>
            </>
          );
          const classes = cn(
            'rounded-control grid min-h-11 justify-items-center gap-1 border-b-4 px-1 py-2 text-center',
            item.state === 'done' && 'border-action',
            item.state === 'current' && 'border-brand bg-brand-soft',
            item.state === 'upcoming' && 'border-line',
          );
          return (
            <li key={item.key} className="min-w-0">
              {item.href ? (
                <a
                  href={item.href}
                  aria-current={item.state === 'current' ? 'step' : undefined}
                  onClick={item.onSelect}
                  className={cn(classes, 'hover:bg-surface-muted')}
                >
                  {content}
                </a>
              ) : (
                <div aria-current={item.state === 'current' ? 'step' : undefined} className={classes}>
                  {content}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
