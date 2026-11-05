import { cn } from '@/lib/cn';

/*
 * Signature KSP, tirée du logo : une barre bleu nuit, une barre verte, une flèche or. Elle remplace le
 * motif tissé. Deux usages :
 *   - `SignatureRule` : séparateur discret (haut du pied de page, sous un titre) ;
 *   - `SignatureProgress` : fil de progression d'un parcours (étapes d'une demande, d'une mission, du
 *     simulateur, d'un formulaire) : étapes franchies en bleu nuit, étape en cours en vert, la flèche or
 *     pointe vers la suite.
 * HTML et SVG rendus par le serveur, aucune ligne de JavaScript. Couleurs : jetons `signature-*`, qui
 * s'inversent d'eux-mêmes sur fond bleu nuit.
 */

/** Pointe de flèche or (triangle du logo). */
export function SignatureArrow({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 12 14" aria-hidden="true" focusable="false" className={cn('shrink-0', className)}>
      <path d="M0 0L12 7L0 14Z" className="fill-signature-3" />
    </svg>
  );
}

const RULE_SIZES = {
  sm: { bar: 'h-1', arrow: 'h-2.5 w-2', gap: 'gap-1' },
  md: { bar: 'h-1.5', arrow: 'h-3.5 w-3', gap: 'gap-1.5' },
} as const;

/** Séparateur signature : un tiers bleu nuit, le reste en vert, la flèche or au bout. */
export function SignatureRule({
  size = 'sm',
  className,
}: {
  size?: keyof typeof RULE_SIZES;
  className?: string;
}) {
  const s = RULE_SIZES[size];
  return (
    <span aria-hidden="true" className={cn('flex items-center', s.gap, className)}>
      <span className={cn('bg-signature-1 basis-[38%] rounded-l-full', s.bar)} />
      <span className={cn('bg-signature-2 flex-1', s.bar)} />
      <SignatureArrow className={cn('-ml-0.5', s.arrow)} />
    </span>
  );
}

/* Lignes de la toile de fond : départ, longueurs des barres bleu nuit et verte, hauteur, épaisseur. */
const BACKDROP_ROWS: ReadonlyArray<readonly [number, number, number, number, number]> = [
  [150, 120, 150, 38, 10],
  [40, 200, 110, 92, 16],
  [230, 70, 120, 152, 8],
  [90, 150, 170, 206, 14],
  [260, 90, 70, 262, 10],
];

/**
 * Toile de fond décorative : des lignes de signature (barre, barre, flèche) qui filent vers la droite,
 * en filigrane. Remplace la trame tissée ; l'intensité se règle par l'opacité (`opacity-…`).
 */
export function SignatureBackdrop({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 480 300"
      preserveAspectRatio="xMaxYMid slice"
      aria-hidden="true"
      focusable="false"
      className={cn('pointer-events-none', className)}
    >
      {BACKDROP_ROWS.map(([x, first, second, y, h]) => (
        <g key={y}>
          <rect x={x} y={y} width={first} height={h} rx={h / 2} className="fill-signature-1" />
          <rect x={x + first + h * 0.6} y={y} width={second} height={h} className="fill-signature-2" />
          <path
            d={`M${x + first + second + h * 0.9} ${y - h * 0.6}L${x + first + second + h * 3.4} ${y + h / 2}L${x + first + second + h * 0.9} ${y + h * 1.6}Z`}
            className="fill-signature-3"
          />
        </g>
      ))}
    </svg>
  );
}

export type ProgressStepState = 'done' | 'current' | 'upcoming';

export interface SignatureProgressStep {
  label: string;
}

/** État d'une étape de `SignatureProgress`, d'après l'étape en cours. */
export function stepState(index: number, current: number): ProgressStepState {
  if (index < current) return 'done';
  return index === current ? 'current' : 'upcoming';
}

const SEGMENT: Record<ProgressStepState, string> = {
  done: 'bg-signature-1',
  current: 'bg-signature-2',
  upcoming: 'bg-signature-track',
};

/**
 * Fil de progression d'un parcours. `current` : index de l'étape en cours (`steps.length` : tout est
 * fait). `stopped` : parcours arrêté (annulé, refusé…) sur l'étape `current`, sans flèche vers la suite.
 * Liste ordonnée accessible : chaque étape annonce son état ; l'étape en cours porte `aria-current`.
 */
export function SignatureProgress({
  steps,
  current,
  label,
  stopped = false,
  showLabels = true,
  className,
}: {
  steps: ReadonlyArray<SignatureProgressStep>;
  current: number;
  /** Nom accessible du fil (« Avancement de la demande »). */
  label: string;
  stopped?: boolean;
  /** Libellés sous les segments (à partir de 640 px ; sur téléphone, seule l'étape en cours est nommée). */
  showLabels?: boolean;
  className?: string;
}) {
  const done = current >= steps.length;
  const active = steps[Math.min(current, steps.length - 1)];
  return (
    <div className={className}>
      {showLabels && active ? (
        <p aria-hidden="true" className="text-small text-ink-muted font-semibold sm:hidden">
          {done ? `${steps.length} / ${steps.length}` : `${current + 1} / ${steps.length}`}
          <span className="text-ink"> · {active.label}</span>
        </p>
      ) : null}
      <ol
        aria-label={label}
        className="mt-2 grid auto-cols-fr grid-flow-col gap-1.5 sm:mt-0"
        data-stopped={stopped || undefined}
      >
        {steps.map((step, index) => {
          const state = stepState(index, current);
          const halted = stopped && state === 'current';
          return (
            <li key={step.label} aria-current={state === 'current' ? 'step' : undefined} className="min-w-0">
              <span aria-hidden="true" className="flex h-3.5 items-center">
                <span
                  className={cn(
                    'h-1.5 flex-1',
                    index === 0 && 'rounded-l-full',
                    index === steps.length - 1 && state !== 'current' && 'rounded-r-full',
                    halted ? 'bg-line-strong' : SEGMENT[state],
                    state === 'current' && !halted && 'progress-grow',
                  )}
                />
                {state === 'current' && !halted ? <SignatureArrow className="-ml-px h-3.5 w-3" /> : null}
              </span>
              <span
                className={cn(
                  'mt-2 text-xs leading-snug',
                  // Sur téléphone, le libellé reste lu par les lecteurs d'écran (seul l'en cours est affiché).
                  showLabels ? 'sr-only sm:not-sr-only sm:block' : 'sr-only',
                  state === 'upcoming' ? 'text-ink-subtle' : 'text-ink font-semibold',
                )}
              >
                {step.label}
              </span>
              <span className="sr-only">
                {state === 'done'
                  ? ' (terminée)'
                  : state === 'current'
                    ? halted
                      ? ' (arrêtée)'
                      : ' (en cours)'
                    : ' (à venir)'}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
