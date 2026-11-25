'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { useResource } from '@/lib/use-resource';
import type { CleaningAccess } from '@/features/cleaning/access';
import { allHolidays } from '@/features/cleaning/api';
import { allVisits } from '@/features/cleaning/requests-api';
import type { Visit } from '@/features/cleaning/requests-schemas';
import {
  type CalendarValues,
  calendarQuery,
  hasVisitFilters,
  periodDays,
  readCalendar,
  toVisitFilters,
  visitsByDay,
} from '@/features/cleaning/visits-calendar';
import { visitsTexts } from '@/features/cleaning/visits-texts';
import { cleaningTexts } from '@/features/cleaning/texts';
import { VisitPanel } from './visit-panel';
import { VisitsGrid } from './visits-grid';
import { CalendarNav, VisitsFilterBar } from './visits-toolbar';
import { LoadingBlock, Note, ResourceView, useCleaningAccess } from './parts';

const t = visitsTexts;
/** Garde-fou de `readAll` : 10 pages de 100. */
const CAP = 1000;

/** Jours fériés des années de la période (droit de lecture du catalogue) ; rien si la lecture échoue. */
export function useHolidays(days: readonly string[], canRead: boolean): ReadonlyMap<string, string> {
  const years = [...new Set(days.map((day) => Number(day.slice(0, 4))))].join(',');
  const holidays = useResource(
    useCallback(async () => {
      if (!canRead) return [];
      const lists = await Promise.allSettled(years.split(',').map((year) => allHolidays(Number(year))));
      return lists.flatMap((list) => (list.status === 'fulfilled' ? list.value : []));
    }, [years, canRead]),
  );
  return useMemo(
    () =>
      new Map(
        holidays.state.status === 'ready' ? holidays.state.data.map((item) => [item.date, item.name]) : [],
      ),
    [holidays.state],
  );
}

type Selection = { visit: Visit; trigger: HTMLButtonElement | null };

/** Visites de la période et filtres affichés ; une visite choisie ouvre le panneau de gestion. */
function Calendar({ values, access }: { values: CalendarValues; access: CleaningAccess }) {
  const days = useMemo(() => periodDays(values), [values]);
  const filtersKey = JSON.stringify(toVisitFilters(values));
  const visits = useResource(useCallback(() => allVisits(JSON.parse(filtersKey)), [filtersKey]));
  const holidays = useHolidays(days, access['cleaning.catalog.read']);
  const [selection, setSelection] = useState<Selection | null>(null);

  const close = () => {
    const trigger = selection?.trigger;
    setSelection(null);
    if (trigger?.isConnected) trigger.focus();
  };

  return (
    <div className="grid gap-4">
      <ResourceView resource={visits} lines={8}>
        {(list) => {
          const byDay = visitsByDay(list);
          return (
            <div className="grid gap-4">
              <p className="text-small text-ink-muted" aria-live="polite">
                {t.count(list.length)}
              </p>
              {list.length >= CAP ? <Note>{t.capped}</Note> : null}
              {list.length ? null : <Note>{hasVisitFilters(values) ? t.empty : t.emptyAll}</Note>}
              <VisitsGrid
                days={days}
                byDay={byDay}
                holidays={holidays}
                selectedId={selection?.visit.id ?? null}
                onSelect={(visit, trigger) =>
                  selection?.visit.id === visit.id ? close() : setSelection({ visit, trigger })
                }
              />
            </div>
          );
        }}
      </ResourceView>
      {selection ? (
        <VisitPanel
          key={selection.visit.id}
          visit={selection.visit}
          access={access}
          onChanged={visits.refresh}
          onClose={close}
        />
      ) : null}
    </div>
  );
}

/** Calendrier des visites (`/nettoyage/visites`) : vue jour ou semaine, filtres dans l'adresse. */
export function VisitsCalendar() {
  const access = useCleaningAccess();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const query = params.toString();
  const values = useMemo(() => readCalendar(new URLSearchParams(query)), [query]);

  if (!access) return <LoadingBlock lines={8} />;
  if (!access['cleaning.request.read']) return <Note>{cleaningTexts.common.forbidden}</Note>;

  const update = (changes: Partial<CalendarValues>) => {
    const next = calendarQuery(query, changes);
    router.replace(next ? `${pathname}?${next}` : pathname);
  };

  return (
    <div className="grid gap-6">
      <CalendarNav values={values} onChange={update} />
      <VisitsFilterBar values={values} access={access} onChange={update} />
      <Calendar key={JSON.stringify(values)} values={values} access={access} />
    </div>
  );
}
