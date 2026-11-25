'use client';

import Link from 'next/link';
import { cn } from '@/lib/cn';
import { cleaningPaths } from '@/features/cleaning/paths';
import { requestDetailTexts } from '@/features/cleaning/request-detail-texts';
import { nextAction, STEPS, type StepState, stepStates } from '@/features/cleaning/request-steps';
import type { CleaningRequest } from '@/features/cleaning/requests-schemas';
import { followTexts } from '@/features/cleaning/request-work-texts';

const t = requestDetailTexts;

const DOT: Record<StepState, string> = {
  done: 'bg-success border-success text-on-action',
  current: 'bg-action-strong border-action-strong text-on-action',
  todo: 'bg-surface border-line-control text-ink-muted',
  stopped: 'bg-surface-muted border-ink-muted text-ink-muted',
};

/** Frise des étapes : où en est le dossier (liste ordonnée, l'étape en cours marquée `aria-current`). */
export function RequestProgress({ request }: { request: CleaningRequest }) {
  const states = stepStates(request);
  return (
    <nav aria-label={t.steps.label}>
      <ol className="grid grid-cols-5 gap-1 sm:gap-2">
        {STEPS.map((step, index) => {
          const state = states[step];
          return (
            <li key={step} className="grid min-w-0 justify-items-center gap-1 text-center">
              <a
                href={`#etape-${step}`}
                aria-current={state === 'current' ? 'step' : undefined}
                className="focus-visible:outline-focus grid min-h-11 min-w-11 justify-items-center gap-1 rounded-md focus-visible:outline-2"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'grid size-8 place-items-center rounded-full border-2 text-sm font-semibold tabular-nums',
                    DOT[state],
                  )}
                >
                  {index + 1}
                </span>
                <span
                  className={cn(
                    'text-small leading-tight break-words',
                    state === 'current' ? 'text-ink font-semibold' : 'text-ink-muted',
                  )}
                >
                  {t.steps.names[step]}
                </span>
                <span className="sr-only">, {t.steps.states[state]}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Action suivante mise en avant, avec le lien vers l'étape où elle se fait. */
export function NextAction({ request }: { request: CleaningRequest }) {
  const next = nextAction(request);
  const program = next.key === 'openProgram' && request.programId;
  return (
    <section
      aria-labelledby="action-suivante"
      className={cn(
        'rounded-card grid gap-2 border p-4',
        next.action ? 'border-action bg-action-soft' : 'border-line bg-surface-muted',
      )}
    >
      <h2 id="action-suivante" className="text-small text-ink-muted font-semibold">
        {t.next.title}
      </h2>
      <p className={cn('text-ink', next.action ? 'font-semibold' : undefined)}>{t.next.labels[next.key]}</p>
      {program ? (
        <Link
          href={cleaningPaths.program(program)}
          className="text-accent-ink inline-flex min-h-11 items-center justify-self-start font-semibold underline"
        >
          {followTexts.program}
        </Link>
      ) : next.action ? (
        <a
          href={`#etape-${next.step}`}
          className="text-accent-ink inline-flex min-h-11 items-center justify-self-start font-semibold underline"
        >
          {t.next.go} « {t.steps.names[next.step]} »
        </a>
      ) : null}
    </section>
  );
}
