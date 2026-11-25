'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/lib/format';
import type { AgentOption, Team } from '@/features/cleaning/agents-schemas';
import { cleaningPaths } from '@/features/cleaning/paths';
import { getPlanning } from '@/features/cleaning/planning-api';
import type { Assignment, AssignmentBatch, PlanningItem } from '@/features/cleaning/planning-schemas';
import { planningTexts } from '@/features/cleaning/planning-texts';
import { itemTimes, itemWindow, requestSearch } from '@/features/cleaning/planning-view';
import { AssignedAgents } from './assignment-actions';
import { AssignForm } from './assignment-form';
import { ItemBadges, itemTitle } from './planning-item';
import { Note } from './parts';

const t = planningTexts;

export interface PlanningChoices {
  agents: AgentOption[];
  teams: Team[];
  /** Identifiant d'agent → « Prénom Nom ». */
  names: Map<string, string>;
}

/** Détails utiles à l'affectation : quand, où, types, compétences, lien vers le dossier. */
function Details({ item }: { item: PlanningItem }) {
  const times = itemTimes(item);
  return (
    <div className="grid gap-2">
      <p className="text-ink">
        {formatDateTime(item.start)} – {times.end} · {item.communeName}
      </p>
      <ItemBadges item={item} />
      <dl className="text-small grid gap-1 sm:grid-cols-[auto_1fr] sm:gap-x-3">
        <dt className="text-ink-muted">{t.types}</dt>
        <dd className="text-ink">{item.cleaningTypes.map((type) => type.name).join(', ') || '—'}</dd>
        <dt className="text-ink-muted">{t.skills}</dt>
        <dd className="text-ink">{item.requiredSkills.join(', ') || t.noSkill}</dd>
      </dl>
      {item.kind === 'visit' ? (
        <Link
          href={`${cleaningPaths.requests}${requestSearch(item.number)}`}
          className="text-accent-ink inline-flex min-h-11 items-center justify-self-start font-semibold underline"
        >
          {t.openRequest}
        </Link>
      ) : (
        <Note>{t.noProgramLink}</Note>
      )}
    </div>
  );
}

/**
 * Intervention choisie (planning ou colonne « à affecter ») : détails, agents affectés et leurs actions,
 * formulaire d'affectation. Après une action, l'intervention est relue (fenêtre d'une minute du
 * planning) et l'écran relit le planning et la colonne « à affecter ».
 */
export function PlanningPanel({
  item: initial,
  choices,
  known,
  onChanged,
  onClose,
}: {
  item: PlanningItem;
  choices: PlanningChoices;
  known: ReadonlyMap<string, Assignment>;
  onChanged: (added: readonly Assignment[], gone: Assignment | null) => void;
  onClose: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [item, setItem] = useState(initial);
  const titleId = `intervention-${initial.id}-titre`;

  useEffect(() => {
    heading.current?.focus();
  }, [initial.id]);

  async function reload() {
    try {
      const fresh = await getPlanning(itemWindow(item));
      const found = fresh.items.find((other) => other.kind === item.kind && other.id === item.id);
      if (found) setItem(found);
    } catch {
      // L'intervention affichée reste celle d'avant ; le planning de l'écran est relu à part.
    }
  }

  const changed = (batch: AssignmentBatch | null, gone: Assignment | null) => {
    onChanged(batch?.assignments ?? [], gone);
    void reload();
  };

  return (
    <section
      aria-labelledby={titleId}
      className="rounded-card border-line bg-surface-muted grid gap-4 border p-3 sm:p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={titleId} ref={heading} tabIndex={-1} className="text-ink text-h3 font-semibold">
          {itemTitle(item)}
        </h2>
        <Button variant="ghost" onClick={onClose}>
          {t.close}
        </Button>
      </div>
      <Details item={item} />
      <AssignedAgents item={item} known={known} agents={choices.agents} onChanged={changed} />
      <section aria-labelledby={`${titleId}-affecter`} className="grid gap-3">
        <h3 id={`${titleId}-affecter`} className="text-ink font-semibold">
          {t.unassigned.assign}
        </h3>
        <AssignForm
          item={item}
          agents={choices.agents}
          teams={choices.teams}
          names={choices.names}
          onDone={(batch) => changed(batch, null)}
        />
      </section>
    </section>
  );
}
