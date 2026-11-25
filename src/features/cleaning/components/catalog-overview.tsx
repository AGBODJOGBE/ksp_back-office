'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { useResource } from '@/lib/use-resource';
import {
  countCleaningTypes,
  countOffers,
  countParameters,
  countPlaceCategories,
  countPlaceTypes,
  countSkills,
} from '@/features/cleaning/api';
import { catalogTexts } from '@/features/cleaning/catalog-texts';
import { CATALOG_STEPS, type CatalogStepKey } from '@/features/cleaning/sections';
import { Panel } from './parts';

const t = catalogTexts.overview;

/** Nombre d'éléments de chaque étape (`total` des listes) ; une lecture en échec n'empêche pas les autres. */
async function loadCounts(): Promise<Partial<Record<CatalogStepKey, number | null>>> {
  const steps: Array<[CatalogStepKey, () => Promise<number>]> = [
    ['parameters', countParameters],
    ['categories', countPlaceCategories],
    ['places', countPlaceTypes],
    ['skills', countSkills],
    ['types', countCleaningTypes],
    ['offers', countOffers],
  ];
  const results = await Promise.allSettled(steps.map(([, count]) => count()));
  return Object.fromEntries(
    steps.map(([key], index) => {
      const result = results[index];
      return [key, result?.status === 'fulfilled' ? result.value : null];
    }),
  );
}

/** Étapes facultatives ou sans liste : jamais proposées comme « à faire ensuite ». */
const OPTIONAL: readonly CatalogStepKey[] = ['skills', 'simulator'];

/**
 * Accueil du catalogue : l'ordre de construction, l'état de chaque étape (nombre d'éléments) et la
 * première étape encore vide, mise en avant. Aide à l'orientation seulement : aucune règle n'en découle.
 */
export function CatalogOverview() {
  const counts = useResource(loadCounts);
  const data = counts.state.status === 'ready' ? counts.state.data : null;
  const next = data
    ? CATALOG_STEPS.find((step) => !OPTIONAL.includes(step.key) && data[step.key] === 0)?.key
    : undefined;
  return (
    <div className="grid gap-6">
      <section aria-labelledby="catalogue-etapes" className="grid gap-3">
        <h2 id="catalogue-etapes" className="font-display text-h3 text-ink font-semibold">
          {t.title}
        </h2>
        <ol className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {CATALOG_STEPS.map((step, index) => {
            const count = data?.[step.key];
            const isNext = step.key === next;
            return (
              <li
                key={step.key}
                className={
                  isNext
                    ? 'rounded-card border-action bg-action-soft has-[a:focus-visible]:outline-focus relative grid content-start gap-2 border-2 p-4 has-[a:focus-visible]:outline-2'
                    : 'rounded-card border-line bg-surface has-[a:focus-visible]:outline-focus relative grid content-start gap-2 border p-4 has-[a:focus-visible]:outline-2'
                }
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="bg-brand text-on-brand grid size-7 place-items-center rounded-full text-sm font-semibold tabular-nums"
                  >
                    {index + 1}
                  </span>
                  <Link
                    href={step.href}
                    className="stretched-link text-ink font-semibold underline-offset-4 hover:underline"
                    aria-label={`${index + 1}. ${step.label}`}
                  >
                    {step.label}
                  </Link>
                  {isNext ? <Badge tone="action">{t.next}</Badge> : null}
                </div>
                <p className="text-small text-ink-muted">{step.text}</p>
                {step.key === 'simulator' ? null : (
                  <p className="text-small text-ink font-medium" aria-live="polite">
                    {counts.state.status === 'loading'
                      ? '…'
                      : count === null || count === undefined
                        ? t.countUnknown
                        : t.count(count)}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      </section>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={t.visibilityTitle} id="catalogue-visibilite">
          <p className="text-ink-muted">{t.visibility}</p>
        </Panel>
        <Panel title={t.tariffTitle} id="catalogue-tarifs">
          <p className="text-ink-muted">{t.tariff}</p>
        </Panel>
      </div>
    </div>
  );
}
