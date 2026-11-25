'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { formatDateTime } from '@/lib/format';
import type { PlanningItem } from '@/features/cleaning/planning-schemas';
import { itemStatus, planningTexts } from '@/features/cleaning/planning-texts';
import { itemTimes, staffing } from '@/features/cleaning/planning-view';
import { StatusBadge } from './request-parts';

const t = planningTexts;

export type SelectItem = (item: PlanningItem, trigger: HTMLButtonElement) => void;

/** Titre lisible d'une intervention (visite d'un dossier ou séance d'un programme). */
export const itemTitle = (item: PlanningItem) => t.itemTitle(item.kind, item.number, item.rank);

/** Agents affectés : chef d'abord, confirmation entre parenthèses quand elle n'est pas acquise. */
export function AgentNames({ item }: { item: PlanningItem }) {
  if (!item.agents.length) return <span className="text-small text-ink-muted">{t.noAgent}</span>;
  const agents = [...item.agents].sort((a, b) => Number(b.isLead) - Number(a.isLead));
  return (
    <ul className="text-small text-ink flex flex-wrap gap-x-3 gap-y-1">
      {agents.map((agent) => (
        <li key={agent.agentId}>
          {agent.firstName} {agent.lastName}
          {agent.isLead ? <span className="text-ink-muted"> ({t.leadBadge})</span> : null}
          {agent.confirmation === 'confirmed' ? null : (
            <span className="text-ink-muted"> — {t.confirmation[agent.confirmation]}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Effectif, urgence, retard et rattrapage proposé. */
export function ItemBadges({ item }: { item: PlanningItem }) {
  const staff = staffing(item);
  return (
    <div className="flex flex-wrap items-center gap-1">
      <StatusBadge status={itemStatus(item.kind, item.status)} />
      <Badge tone={staff.full ? 'success' : 'warning'}>{t.staffing(staff.count, item.teamSize)}</Badge>
      {item.urgent ? <Badge tone="danger">{t.urgent}</Badge> : null}
      {item.late ? <Badge tone="danger">{t.late}</Badge> : null}
      {item.suggestedStart ? (
        <Badge tone="accent">{t.suggested(formatDateTime(item.suggestedStart))}</Badge>
      ) : null}
    </div>
  );
}

/**
 * Une intervention du planning : heure (ou date et heure dans la colonne « à affecter »), titre,
 * commune, badges, agents et bouton d'action qui ouvre le panneau de gestion.
 */
export function PlanningItemCard({
  item,
  selected,
  onSelect,
  withDate = false,
  action = t.manage,
}: {
  item: PlanningItem;
  selected: boolean;
  onSelect: SelectItem;
  withDate?: boolean;
  action?: string;
}) {
  const times = itemTimes(item);
  const title = itemTitle(item);
  const when = withDate ? formatDateTime(item.start) : t.time(times.start, times.end);
  return (
    <li
      className={cn(
        'rounded-control border-line bg-surface grid min-w-0 gap-2 border p-3',
        !staffing(item).full && 'border-l-warning border-l-4',
        selected && 'ring-accent ring-2',
      )}
    >
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-ink font-semibold tabular-nums">{when}</span>
        <span className="text-small text-ink-muted">{t.kinds[item.kind]}</span>
      </div>
      <p className="text-ink font-semibold break-words">{title}</p>
      <p className="text-small text-ink-muted">{item.communeName}</p>
      <ItemBadges item={item} />
      <AgentNames item={item} />
      <Button
        variant={withDate ? 'action' : 'ghost'}
        className="justify-self-start"
        aria-label={`${action} : ${title}, ${when}`}
        aria-pressed={selected}
        onClick={(event) => onSelect(item, event.currentTarget)}
      >
        {action}
      </Button>
    </li>
  );
}
