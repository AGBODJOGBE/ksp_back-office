'use client';

import Link from 'next/link';
import type { CSSProperties } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { beninDay, formatDate } from '@/lib/format';
import { cleaningPaths } from '@/features/cleaning/paths';
import { visitStatus } from '@/features/cleaning/request-detail-texts';
import type { Visit } from '@/features/cleaning/requests-schemas';
import { gridHours, visitsAt, visitTimes } from '@/features/cleaning/visits-calendar';
import { visitsTexts } from '@/features/cleaning/visits-texts';
import { StatusBadge } from './request-parts';

const t = visitsTexts;

/** Variables CSS de placement dans la grille horaire (écran large). */
const place = (vars: Record<string, number>) =>
  Object.fromEntries(Object.entries(vars).map(([name, value]) => [`--${name}`, value])) as CSSProperties;

/** Une visite : heure, dossier, agents, statut, bouton « Gérer ». */
function VisitItem({
  visit,
  selected,
  onSelect,
}: {
  visit: Visit;
  selected: boolean;
  onSelect: (visit: Visit, trigger: HTMLButtonElement) => void;
}) {
  const times = visitTimes(visit);
  const agents = visit.agents.map((agent) => `${agent.firstName} ${agent.lastName}`).join(', ');
  return (
    <li
      className={cn(
        'rounded-control border-line bg-surface grid gap-1 border p-2',
        selected && 'ring-accent ring-2',
      )}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-ink font-semibold tabular-nums">{t.time(times.start, times.end)}</span>
        <StatusBadge status={visitStatus(visit.status)} />
      </div>
      <Link
        href={cleaningPaths.request(visit.requestId)}
        aria-label={t.request(visit.requestNumber)}
        className="text-accent-ink min-h-6 justify-self-start font-semibold break-all underline"
      >
        {visit.requestNumber}
      </Link>
      <span className={cn('text-small', agents ? 'text-ink' : 'text-ink-muted')}>{agents || t.noAgent}</span>
      <Button
        variant="ghost"
        className="justify-self-start"
        aria-label={t.manageLabel(visit.requestNumber, times.start)}
        aria-pressed={selected}
        onClick={(event) => onSelect(visit, event.currentTarget)}
      >
        {t.manage}
      </Button>
    </li>
  );
}

/** En-tête d'un jour : date, jour férié, aujourd'hui, nombre de visites. */
function DayHeading({ day, holiday, count }: { day: string; holiday?: string; count: number }) {
  return (
    <div className="lg:border-line grid gap-1 lg:[grid-column:var(--col)] lg:[grid-row:1] lg:border-b lg:border-l lg:p-2">
      <h3 className="text-ink font-semibold">{formatDate(`${day}T12:00:00Z`)}</h3>
      <div className="flex flex-wrap gap-1">
        {day === beninDay(new Date()) ? <Badge tone="brand">{t.todayBadge}</Badge> : null}
        {holiday ? <Badge tone="warning">{t.holiday(holiday)}</Badge> : null}
        <span className="text-small text-ink-muted">{t.dayCount(count)}</span>
      </div>
    </div>
  );
}

/**
 * Calendrier : un bloc par jour dans l'ordre de lecture (liste par jour sur téléphone, sans grille
 * horaire) ; sur écran large, les mêmes blocs sont placés dans une grille heures × jours. Les cases
 * vides ne servent qu'au repère visuel et sont masquées aux lecteurs d'écran.
 */
export function VisitsGrid({
  days,
  byDay,
  holidays,
  selectedId,
  onSelect,
}: {
  days: readonly string[];
  byDay: ReadonlyMap<string, Visit[]>;
  holidays: ReadonlyMap<string, string>;
  selectedId: string | null;
  onSelect: (visit: Visit, trigger: HTMLButtonElement) => void;
}) {
  const hours = gridHours([...byDay.values()].flat());
  return (
    <div
      role="group"
      aria-label={t.grid}
      style={place({ days: days.length })}
      className="lg:rounded-card lg:border-line grid gap-6 lg:[grid-template-columns:3.5rem_repeat(var(--days),minmax(0,1fr))] lg:gap-0 lg:border"
    >
      {hours.map((hour, row) => (
        <span
          key={hour}
          aria-hidden
          style={place({ row: row + 2 })}
          className="text-small text-ink-muted lg:border-line hidden p-1 tabular-nums lg:[grid-column:1] lg:[grid-row:var(--row)] lg:block lg:border-t"
        >
          {t.hour(hour)}
        </span>
      ))}
      {days.map((day, column) => {
        const visits = byDay.get(day) ?? [];
        return (
          <div key={day} style={place({ col: column + 2 })} className="grid gap-2 lg:contents">
            <DayHeading day={day} holiday={holidays.get(day)} count={visits.length} />
            {visits.length ? null : <p className="text-small text-ink-muted lg:hidden">{t.emptyDay}</p>}
            {hours.map((hour, row) => {
              const items = visitsAt(visits, hour);
              return (
                <div
                  key={hour}
                  aria-hidden={items.length ? undefined : true}
                  style={place({ row: row + 2 })}
                  className={cn(
                    'lg:border-line min-w-0 lg:[grid-column:var(--col)] lg:[grid-row:var(--row)] lg:border-t lg:border-l lg:p-1',
                    items.length ? undefined : 'max-lg:hidden lg:min-h-10',
                  )}
                >
                  {items.length ? (
                    <ul className="grid gap-2 lg:gap-1">
                      {items.map((visit) => (
                        <VisitItem
                          key={visit.id}
                          visit={visit}
                          selected={visit.id === selectedId}
                          onSelect={onSelect}
                        />
                      ))}
                    </ul>
                  ) : null}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
