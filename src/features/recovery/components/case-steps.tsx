import { caseDetailTexts } from '@/features/recovery/case-detail-texts';
import { caseSteps, STEP_IDS, type StepId, type StepState } from '@/features/recovery/case-logic';
import type { Case } from '@/features/recovery/case-schemas';
import { cn } from '@/lib/cn';

const t = caseDetailTexts.steps;

/** Section de la fiche qui porte chaque étape (`null` : pas encore livrée, aucun lien). */
const ANCHORS: Record<StepId, string | null> = {
  review: '#dossier-recevabilite',
  notice: '#dossier-amiable',
  payment_plan: '#dossier-echeancier',
  amicable: '#dossier-amiable',
  litigation: '#dossier-contentieux',
};

const DOT: Record<StepState, string> = {
  done: 'bg-action-strong border-action-strong',
  current: 'bg-accent-soft border-accent-ink',
  upcoming: 'bg-surface border-line-control',
};

/**
 * Étapes du dossier dans l'ordre du métier (ADR-060, décision 3) : recevabilité, notification,
 * échéancier, relance amiable, puis le contentieux (bientôt). L'étape en cours porte `aria-current`.
 */
export function CaseSteps({ item, litigationShown }: { item: Case; litigationShown: boolean }) {
  const steps = caseSteps(item);
  return (
    <nav aria-label={t.label}>
      <ol className="grid gap-2 sm:grid-cols-5">
        {STEP_IDS.map((id, index) => {
          const state = steps[id];
          const anchor = id === 'litigation' && !litigationShown ? null : ANCHORS[id];
          const label = (
            <>
              <span aria-hidden className={cn('size-3 shrink-0 rounded-full border-2', DOT[state])} />
              <span className="grid">
                <span className={cn('font-semibold', state === 'upcoming' && 'text-ink-muted')}>
                  {index + 1}. {t[id]}
                </span>
                <span className="text-small text-ink-muted">{t[state]}</span>
              </span>
            </>
          );
          const classes = 'flex min-h-11 items-center gap-3 rounded-control px-2 py-1';
          return (
            <li key={id} aria-current={state === 'current' ? 'step' : undefined}>
              {anchor ? (
                <a href={anchor} className={cn(classes, 'hover:bg-surface-muted')}>
                  {label}
                </a>
              ) : (
                <span className={classes}>{label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
