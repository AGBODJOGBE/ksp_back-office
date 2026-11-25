'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmAction } from '@/components/ui/confirm-action';
import { FormMessage } from '@/components/ui/field';
import { formatDateTime } from '@/lib/format';
import { usePagedList } from '@/lib/use-paged-list';
import { assignmentActionTexts, autoTexts } from '@/features/cleaning/assignment-texts';
import { errorText, loadErrorText } from '@/features/cleaning/errors';
import { approveProposals, listProposals, removeAssignment } from '@/features/cleaning/planning-api';
import type { Assignment, AssignmentBatch, PlanningItem } from '@/features/cleaning/planning-schemas';
import { planningTexts } from '@/features/cleaning/planning-texts';
import { BatchSummary } from './assignment-form';
import { itemTitle } from './planning-item';
import { confirmLabels, ReasonField, reasonError, reasonOf, useKeyed } from './request-parts';
import { ListState, Note } from './parts';

const t = autoTexts;

/** Retirer une proposition (désaffectation avec motif), pour la refaire à la main. */
function Withdraw({ proposal, name, onDone }: { proposal: Assignment; name: string; onDone: () => void }) {
  const keyed = useKeyed();
  return (
    <ConfirmAction
      danger
      label={t.withdraw}
      accessibleLabel={t.withdrawLabel(name)}
      title={t.withdrawTitle(name)}
      description={assignmentActionTexts.removeLead}
      confirmLabel={t.withdraw}
      labels={confirmLabels}
      onConfirm={async (data) => {
        const reason = reasonOf(data);
        const invalid = reasonError(reason);
        if (invalid) return invalid;
        try {
          await keyed((key) => removeAssignment(proposal.id, reason, key));
          onDone();
          return null;
        } catch (error) {
          return errorText(error);
        }
      }}
    >
      <ReasonField id={`proposition-${proposal.id}-motif`} />
    </ConfirmAction>
  );
}

/**
 * Propositions de la planification automatique (`GET /planning/proposals`) : choisir tout ou partie,
 * valider en un clic (contrôles refaits, proposition devenue impossible ignorée), ou retirer. Les
 * interventions de la période affichée donnent un titre lisible ; sinon le type et l'identifiant abrégé.
 */
export function ProposalsList({
  zoneKey,
  reload,
  items,
  names,
  onLoaded,
  onChanged,
}: {
  zoneKey: string;
  /** Change quand l'écran veut une relecture (planification automatique lancée…). */
  reload: number;
  items: ReadonlyMap<string, PlanningItem>;
  names: ReadonlyMap<string, string>;
  onLoaded: (proposals: readonly Assignment[]) => void;
  onChanged: (added: readonly Assignment[]) => void;
}) {
  const keyed = useKeyed();
  const load = useMemo(() => {
    void reload; // relue après chaque action de l'écran (validation, retrait, planification)
    return listProposals(zoneKey || undefined);
  }, [zoneKey, reload]);
  const list = usePagedList(load, loadErrorText);
  const [chosen, setChosen] = useState<string[]>([]);
  const [done, setDone] = useState<{ batch: AssignmentBatch; asked: number } | null>(null);

  useEffect(() => onLoaded(list.items), [list.items, onLoaded]);

  const refresh = () => setChosen([]);
  const allIds = list.items.map((proposal) => proposal.id);
  const label = (proposal: Assignment) => {
    const item = items.get(proposal.target.id);
    return item
      ? `${itemTitle(item)}, ${formatDateTime(item.start)}`
      : t.target(planningTexts.kinds[proposal.target.kind], proposal.target.id);
  };

  return (
    <section aria-labelledby="planning-propositions" className="grid gap-3">
      <div>
        <h2 id="planning-propositions" className="text-ink text-h3 font-semibold">
          {t.proposals}
        </h2>
        <p className="text-small text-ink-muted">{t.proposalsLead}</p>
      </div>
      <ListState list={list} empty={<Note>{t.noProposals}</Note>}>
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => setChosen(chosen.length === allIds.length ? [] : allIds)}
            >
              {t.selectAll}
            </Button>
            {chosen.length ? (
              <ConfirmAction
                variant="action"
                label={t.approve(chosen.length)}
                title={t.approveTitle(chosen.length)}
                description={t.approveLead}
                confirmLabel={t.approve(chosen.length)}
                labels={confirmLabels}
                onOpen={() => setDone(null)}
                onConfirm={async () => {
                  try {
                    const batch = await keyed((key) => approveProposals(chosen, key));
                    setDone({ batch, asked: chosen.length });
                    onChanged(batch.assignments);
                    refresh();
                    return null;
                  } catch (error) {
                    return errorText(error);
                  }
                }}
              />
            ) : null}
          </div>
          <ul className="grid gap-2">
            {list.items.map((proposal) => {
              const name =
                names.get(proposal.agentId) ?? `${proposal.agentFirstName} ${proposal.agentLastName}`;
              const target = label(proposal);
              return (
                <li
                  key={proposal.id}
                  className="rounded-control border-line grid gap-2 border p-2 sm:flex sm:items-center sm:justify-between"
                >
                  <label className="flex min-h-11 items-center gap-3">
                    <input
                      type="checkbox"
                      className="size-5 shrink-0"
                      aria-label={t.select(name, target)}
                      checked={chosen.includes(proposal.id)}
                      onChange={(event) =>
                        setChosen(
                          event.target.checked
                            ? [...chosen, proposal.id]
                            : chosen.filter((id) => id !== proposal.id),
                        )
                      }
                    />
                    <span className="grid">
                      <span className="text-ink font-semibold">{`${proposal.agentFirstName} ${proposal.agentLastName}`}</span>
                      <span className="text-small text-ink-muted break-words">{target}</span>
                    </span>
                  </label>
                  <Withdraw
                    proposal={proposal}
                    name={name}
                    onDone={() => {
                      onChanged([{ ...proposal, status: 'removed' }]);
                      refresh();
                    }}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      </ListState>
      <div aria-live="polite" className="grid gap-2">
        {done ? <BatchSummary batch={done.batch} names={names} /> : null}
        {done && done.asked > done.batch.assignments.length ? (
          <FormMessage tone="info">{t.ignored(done.asked - done.batch.assignments.length)}</FormMessage>
        ) : null}
      </div>
    </section>
  );
}
