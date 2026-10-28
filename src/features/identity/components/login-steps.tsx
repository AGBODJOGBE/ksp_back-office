import { IconCheck } from '@/components/ui/icons';
import { cn } from '@/lib/cn';
import { identityTexts } from '@/features/identity/texts';

export type LoginStage = 0 | 1 | 2;

/** Repère des trois étapes de la connexion : téléphone, code reçu, double authentification. */
export function LoginSteps({ stage }: { stage: LoginStage }) {
  const t = identityTexts.stepper;
  const labels = [t.phone, t.code, t.mfa];
  return (
    <ol aria-label={t.label} className="mb-8 grid grid-cols-3 gap-2">
      {labels.map((label, index) => {
        const done = index < stage;
        const current = index === stage;
        return (
          <li
            key={label}
            aria-current={current ? 'step' : undefined}
            className="text-small grid content-start gap-2"
          >
            <span
              aria-hidden="true"
              className={cn('h-1 rounded-full', done || current ? 'bg-accent' : 'bg-surface-sunken')}
            />
            <span
              className={cn(
                'flex items-center gap-1.5 leading-tight',
                current ? 'text-ink font-semibold' : 'text-ink-subtle',
              )}
            >
              {done ? <IconCheck className="text-success size-4" /> : null}
              {label}
              {current || done ? <span className="sr-only"> ({current ? t.current : t.done})</span> : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
