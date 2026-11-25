'use client';

import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { formatDateTime, formatXof } from '@/lib/format';
import { usePagedList } from '@/lib/use-paged-list';
import { caseDetailTexts } from '@/features/recovery/case-detail-texts';
import {
  channelLabel,
  deliveryLabel,
  directionLabel,
  journalKindLabel,
  outcomeLabel,
} from '@/features/recovery/case-texts';
import { listJournal } from '@/features/recovery/cases-api';
import { loadErrorText } from '@/features/recovery/errors';
import type { JournalEntry } from '@/features/recovery/journal-schemas';
import { actorName } from '@/features/recovery/texts';
import { ListState, Note, Panel } from './parts';

const t = caseDetailTexts.journal;

function Entry({ entry }: { entry: JournalEntry }) {
  const details = [
    entry.channel ? channelLabel(entry.channel) : null,
    entry.direction ? directionLabel(entry.direction) : null,
    entry.outcome ? outcomeLabel(entry.outcome) : null,
    entry.deliveryStatus ? deliveryLabel(entry.deliveryStatus) : null,
    entry.amount ? formatXof(entry.amount) : null,
  ].filter((value) => value !== null);
  return (
    <li className="border-line grid gap-1 border-t pt-3 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{journalKindLabel(entry.kind)}</span>
        {entry.internal && entry.kind !== 'note' ? <Badge tone="accent">{t.internal}</Badge> : null}
      </div>
      <p className="break-words whitespace-pre-line">{entry.summary}</p>
      {details.length ? <p className="text-small">{details.join(' · ')}</p> : null}
      <p className="text-small text-ink-muted">
        {t.by(actorName(entry.author), formatDateTime(entry.occurredAt))}
      </p>
    </li>
  );
}

/**
 * Journal de preuve du dossier (`GET /recovery/cases/{id}/journal`, notes internes comprises), une
 * page à la fois. Après chaque action, la fiche le remonte (`key`) : il est relu depuis le début.
 */
export function CaseJournal({ caseId }: { caseId: string }) {
  const load = useMemo(() => listJournal(caseId), [caseId]);
  const list = usePagedList(load, loadErrorText);
  return (
    <Panel title={t.title} id="dossier-journal">
      <p className="text-ink-muted">{t.lead}</p>
      <ListState list={list} empty={<Note>{t.empty}</Note>}>
        <ol className="grid gap-3">
          {list.items.map((entry) => (
            <Entry key={entry.id} entry={entry} />
          ))}
        </ol>
      </ListState>
    </Panel>
  );
}
