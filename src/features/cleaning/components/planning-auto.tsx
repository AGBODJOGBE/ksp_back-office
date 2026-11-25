'use client';

import { type FormEvent, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FormMessage, TextField } from '@/components/ui/field';
import { autoTexts } from '@/features/cleaning/assignment-texts';
import { errorText } from '@/features/cleaning/errors';
import { type AutoPlanningBody, runAutoPlanning } from '@/features/cleaning/planning-api';
import type { AutoPlanningRun } from '@/features/cleaning/planning-schemas';
import { failureTexts, planningTexts } from '@/features/cleaning/planning-texts';
import { dayStart, nextDayStart } from '@/features/cleaning/planning-view';
import { useKeyed } from './request-parts';

const t = autoTexts;

/** Résultat d'un passage : mode appliqué, affectations et propositions, interventions restées à affecter. */
function RunResult({ run }: { run: AutoPlanningRun }) {
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="brand">{t.modes[run.mode]}</Badge>
        <FormMessage tone="success">{t.result(run.assigned, run.proposed)}</FormMessage>
      </div>
      {run.failures.length ? (
        <div className="grid gap-1">
          <p className="text-ink">{t.failures(run.failures.length)}</p>
          <ul className="text-small text-ink-muted list-disc pl-5">
            {run.failures.map((failure) => (
              <li key={`${failure.target.kind}-${failure.target.id}`}>
                {t.failure(
                  planningTexts.kinds[failure.target.kind],
                  failure.target.id,
                  failureTexts[failure.reason],
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Planifier automatiquement (`POST /planning/auto`) sur une période (jours du Bénin, fin incluse) et la
 * commune filtrée du planning ; période vide : de maintenant à l'horizon des réglages.
 */
export function AutoPlanning({ zoneKey, onDone }: { zoneKey: string; onDone: () => void }) {
  const keyed = useKeyed();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [run, setRun] = useState<AutoPlanningRun | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (from && to && to < from) {
      setError(t.badPeriod);
      return;
    }
    setError(null);
    setMessage(null);
    setPending(true);
    const body: AutoPlanningBody = {};
    if (from) body.from = dayStart(from);
    if (to) body.to = nextDayStart(to);
    if (zoneKey) body.zoneKey = zoneKey;
    try {
      setRun(await keyed((key) => runAutoPlanning(body, key)));
      onDone();
    } catch (caught) {
      setMessage(errorText(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-labelledby="planning-auto" className="grid gap-3">
      <div>
        <h2 id="planning-auto" className="text-ink text-h3 font-semibold">
          {t.title}
        </h2>
        <p className="text-small text-ink-muted max-w-reading">{t.lead}</p>
      </div>
      <form noValidate onSubmit={submit} className="grid gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            id="planning-auto-du"
            type="date"
            label={t.from}
            hint={t.periodHint}
            value={from}
            onChange={(event) => {
              setFrom(event.target.value);
              setRun(null);
            }}
          />
          <TextField
            id="planning-auto-au"
            type="date"
            label={t.to}
            value={to}
            error={error}
            onChange={(event) => {
              setTo(event.target.value);
              setRun(null);
            }}
          />
        </div>
        <Button
          type="submit"
          variant="action"
          className="justify-self-start"
          aria-busy={pending || undefined}
          disabled={pending}
        >
          {pending ? t.running : t.run}
        </Button>
        <div aria-live="polite" className="grid gap-2">
          <FormMessage>{message}</FormMessage>
          {run ? <RunResult run={run} /> : null}
        </div>
      </form>
    </section>
  );
}
