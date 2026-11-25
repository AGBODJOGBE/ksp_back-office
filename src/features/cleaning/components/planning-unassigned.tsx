'use client';

import { useMemo } from 'react';
import { usePagedList } from '@/lib/use-paged-list';
import { loadErrorText } from '@/features/cleaning/errors';
import { listUnassigned } from '@/features/cleaning/planning-api';
import { planningTexts } from '@/features/cleaning/planning-texts';
import { PlanningItemCard, type SelectItem } from './planning-item';
import { ListState, Note } from './parts';

const t = planningTexts.unassigned;

/**
 * Colonne « à affecter » (`GET /planning/unassigned`, tri par urgence) : visites à planifier et
 * séances sans équipe complète, indépendantes de la période affichée ; filtrée par commune comme le
 * planning. Relue à chaque affectation (clé changée par l'écran).
 */
export function UnassignedColumn({
  zoneKey,
  selectedId,
  onSelect,
}: {
  zoneKey: string;
  selectedId: string | null;
  onSelect: SelectItem;
}) {
  const load = useMemo(() => listUnassigned(zoneKey || undefined), [zoneKey]);
  const list = usePagedList(load, loadErrorText);
  return (
    <section
      aria-labelledby="planning-a-affecter"
      className="rounded-card border-warning bg-warning-soft grid content-start gap-3 border-2 p-3 sm:p-4"
    >
      <div>
        <h2 id="planning-a-affecter" className="text-ink text-h3 font-semibold">
          {t.title}
        </h2>
        <p className="text-small text-ink-muted">{t.lead}</p>
      </div>
      <ListState list={list} empty={<Note>{t.empty}</Note>}>
        <ul className="grid gap-2">
          {list.items.map((item) => (
            <PlanningItemCard
              key={`${item.kind}-${item.id}`}
              item={item}
              withDate
              action={t.assign}
              selected={item.id === selectedId}
              onSelect={onSelect}
            />
          ))}
        </ul>
      </ListState>
    </section>
  );
}
