'use client';

import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { beninDay, formatDate, formatLongDate } from '@/lib/format';
import { useResource } from '@/lib/use-resource';
import type { CleaningAccess } from '@/features/cleaning/access';
import { listCommunes } from '@/features/cleaning/api';
import { visitStatus } from '@/features/cleaning/request-detail-texts';
import { activeAgents } from '@/features/cleaning/agents-api';
import { VISIT_STATUSES } from '@/features/cleaning/requests-schemas';
import {
  CALENDAR_VIEWS,
  type CalendarValues,
  hasVisitFilters,
  periodDays,
  shiftDay,
} from '@/features/cleaning/visits-calendar';
import { visitsTexts } from '@/features/cleaning/visits-texts';
import { Choice, type Option } from './requests-filter-bar';
import { Note } from './parts';

const t = visitsTexts;
type Change = (changes: Partial<CalendarValues>) => void;

/** Jour du calendrier (`2026-11-23`) lu à midi pour rester sur le même jour au Bénin. */
const noon = (day: string) => `${day}T12:00:00Z`;

/** Titre de la période : le jour en toutes lettres, ou les bornes de la semaine. */
export function periodLabel(values: Pick<CalendarValues, 'view' | 'day'>): string {
  const days = periodDays(values);
  if (values.view === 'jour') return formatLongDate(noon(values.day));
  return t.week(formatDate(noon(days[0] as string)), formatDate(noon(days[6] as string)));
}

type Period = Pick<CalendarValues, 'view' | 'day'>;

/** Vue (jour, semaine), précédent / aujourd'hui / suivant, saut à une date (visites, planning). */
export function CalendarNav({
  values,
  onChange,
  dateId = 'visites-date',
}: {
  values: Period;
  onChange: (changes: Partial<Period>) => void;
  dateId?: string;
}) {
  const today = beninDay(new Date());
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div role="group" aria-label={t.view} className="flex gap-1">
          {CALENDAR_VIEWS.map((view) => (
            <Button
              key={view}
              variant={values.view === view ? 'action' : 'secondary'}
              aria-pressed={values.view === view}
              onClick={() => onChange({ view })}
            >
              {t.views[view]}
            </Button>
          ))}
        </div>
        <div className="flex gap-1">
          <Button
            variant="secondary"
            aria-label={t.previous[values.view]}
            onClick={() => onChange({ day: shiftDay(values, -1) })}
          >
            <span aria-hidden>‹</span>
          </Button>
          <Button variant="secondary" disabled={values.day === today} onClick={() => onChange({ day: '' })}>
            {t.today}
          </Button>
          <Button
            variant="secondary"
            aria-label={t.next[values.view]}
            onClick={() => onChange({ day: shiftDay(values, 1) })}
          >
            <span aria-hidden>›</span>
          </Button>
        </div>
        <TextField
          id={dateId}
          type="date"
          label={t.goTo}
          value={values.day}
          onChange={(event) => {
            if (event.target.value) onChange({ day: event.target.value });
          }}
        />
      </div>
      <h2 className="text-ink text-h3 font-semibold" aria-live="polite">
        <span className="sr-only">{t.period} : </span>
        {periodLabel(values)}
      </h2>
    </div>
  );
}

/** Communes (catalogue) et agents actifs (planification) ; une liste illisible reste vide. */
async function loadChoices(canListAgents: boolean) {
  const [communes, agents] = await Promise.allSettled([
    listCommunes(),
    canListAgents ? activeAgents() : Promise.resolve([]),
  ]);
  return {
    communes:
      communes.status === 'fulfilled'
        ? communes.value.map((item): Option => ({ value: item.communeKey, label: item.name }))
        : [],
    agents:
      agents.status === 'fulfilled'
        ? agents.value.map((item): Option => ({
            value: item.id,
            label: `${item.firstName} ${item.lastName}`,
          }))
        : [],
  };
}

/** Filtres du contrat (`GET /visits`) : statut, agent, commune ; la période vient de la navigation. */
export function VisitsFilterBar({
  values,
  access,
  onChange,
}: {
  values: CalendarValues;
  access: CleaningAccess;
  onChange: Change;
}) {
  const canListAgents = access['cleaning.planning.manage'];
  const choices = useResource(useCallback(() => loadChoices(canListAgents), [canListAgents]));
  const lists = choices.state.status === 'ready' ? choices.state.data : null;
  return (
    <fieldset className="grid gap-3">
      <legend className="sr-only">{t.filters}</legend>
      <div className="grid gap-3 sm:grid-cols-3">
        <Choice
          id="visites-statut"
          label={t.status}
          value={values.status}
          all={t.all}
          options={VISIT_STATUSES.map((code) => ({ value: code, label: visitStatus(code).label }))}
          onChange={(status) => onChange({ status })}
        />
        {canListAgents || values.agentId ? (
          <Choice
            id="visites-agent"
            label={t.agent}
            value={values.agentId}
            all={t.all}
            options={lists?.agents ?? []}
            onChange={(agentId) => onChange({ agentId })}
          />
        ) : null}
        <Choice
          id="visites-commune"
          label={t.commune}
          value={values.communeKey}
          all={t.allFeminine}
          options={lists?.communes ?? []}
          onChange={(communeKey) => onChange({ communeKey })}
        />
      </div>
      {!canListAgents && values.agentId ? <Note>{t.agentsHint}</Note> : null}
      {hasVisitFilters(values) ? (
        <Button
          variant="ghost"
          className="justify-self-start"
          onClick={() => onChange({ status: '', agentId: '', communeKey: '' })}
        >
          {t.clear}
        </Button>
      ) : null}
    </fieldset>
  );
}
