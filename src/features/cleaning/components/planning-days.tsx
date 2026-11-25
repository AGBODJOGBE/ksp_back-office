'use client';

import { Badge } from '@/components/ui/badge';
import { beninDay, formatDate } from '@/lib/format';
import type { AgentLoad, PlanningItem } from '@/features/cleaning/planning-schemas';
import { planningTexts } from '@/features/cleaning/planning-texts';
import { loadShare } from '@/features/cleaning/planning-view';
import { PlanningItemCard, type SelectItem } from './planning-item';
import { Note } from './parts';

const t = planningTexts;

/** En-tête d'un jour : date, aujourd'hui, jour férié, nombre d'interventions. */
function DayHeading({ day, holiday, count }: { day: string; holiday?: string; count: number }) {
  return (
    <div className="border-line flex flex-wrap items-center gap-2 border-b pb-2">
      <h3 className="text-ink font-semibold">{formatDate(`${day}T12:00:00Z`)}</h3>
      {day === beninDay(new Date()) ? <Badge tone="brand">{t.todayBadge}</Badge> : null}
      {holiday ? <Badge tone="warning">{t.holiday(holiday)}</Badge> : null}
      <span className="text-small text-ink-muted">{t.dayCount(count)}</span>
    </div>
  );
}

/**
 * Planning de la période : un bloc par jour dans l'ordre de lecture, interventions par heure de début
 * (une colonne sur téléphone, deux ou trois sur écran large).
 */
export function PlanningDays({
  days,
  byDay,
  holidays,
  selectedId,
  onSelect,
}: {
  days: readonly string[];
  byDay: ReadonlyMap<string, PlanningItem[]>;
  holidays: ReadonlyMap<string, string>;
  selectedId: string | null;
  onSelect: SelectItem;
}) {
  return (
    <div role="group" aria-label={t.grid} className="grid gap-6">
      {days.map((day) => {
        const items = byDay.get(day) ?? [];
        return (
          <section key={day} className="grid gap-3">
            <DayHeading day={day} holiday={holidays.get(day)} count={items.length} />
            {items.length ? (
              <ul className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                {items.map((item) => (
                  <PlanningItemCard
                    key={`${item.kind}-${item.id}`}
                    item={item}
                    selected={item.id === selectedId}
                    onSelect={onSelect}
                  />
                ))}
              </ul>
            ) : (
              <Note>{t.emptyDay}</Note>
            )}
          </section>
        );
      })}
    </div>
  );
}

/** Charge des agents sur la période : heures prévues, maximum et part, en liste lisible au téléphone. */
export function PlanningLoads({ loads }: { loads: readonly AgentLoad[] }) {
  const l = t.loads;
  return (
    <section aria-labelledby="planning-charge" className="grid gap-3">
      <div>
        <h2 id="planning-charge" className="text-ink text-h3 font-semibold">
          {l.title}
        </h2>
        <p className="text-small text-ink-muted">{l.lead}</p>
      </div>
      {loads.length ? (
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {loads.map((load) => {
            const planned = loadShare(load.plannedMinutes, load.maxMinutes);
            const max = loadShare(load.maxMinutes, 0);
            const over = planned.percent !== null && planned.percent > 100;
            return (
              <li key={load.agentId} className="rounded-control border-line grid gap-1 border p-2">
                <span className="text-ink font-semibold">
                  {load.firstName} {load.lastName}
                </span>
                <span className="text-small text-ink tabular-nums">
                  {l.planned} : {planned.label} · {l.max} : {load.maxMinutes ? max.label : l.none}
                  {planned.percent === null ? null : ` · ${l.share} : ${planned.percent} %`}
                </span>
                {over ? (
                  <Badge tone="danger" className="justify-self-start">
                    {l.over}
                  </Badge>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <Note>{l.empty}</Note>
      )}
    </section>
  );
}
