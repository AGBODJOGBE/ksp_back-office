'use client';

import { useCallback, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { ResponsiveTable, type TableColumn } from '@/components/ui/responsive-table';
import { formatDateTime, formatSlot } from '@/lib/format';
import { usePagedList } from '@/lib/use-paged-list';
import { loadErrorText } from '@/features/cleaning/errors';
import { cleaningPaths } from '@/features/cleaning/paths';
import { listProgramSessions, type SessionFilters } from '@/features/cleaning/programs-api';
import {
  type CleaningSession,
  PAYMENT_STATUSES,
  type Program,
  SESSION_STATUSES,
} from '@/features/cleaning/programs-schemas';
import { paymentStatus, sessionStatus } from '@/features/cleaning/programs-texts';
import { sessionsTexts } from '@/features/cleaning/session-texts';
import { RowLink } from './catalog-parts';
import { Amount, ListState, Note, Panel } from './parts';
import { Choice } from './requests-filter-bar';

const t = sessionsTexts;
const c = t.columns;

/** Paiement d'une séance : statut et échéance (particulier), ou facture mensuelle (entreprise). */
export function PaymentCell({ session }: { session: CleaningSession }) {
  if (session.paymentStatus === null) return <span className="text-ink-muted">{t.invoiced}</span>;
  const status = paymentStatus(session.paymentStatus);
  return (
    <span className="grid justify-items-start gap-0.5">
      <Badge tone={status.tone}>{status.label}</Badge>
      {session.dueBy && (session.paymentStatus === 'due' || session.paymentStatus === 'overdue') ? (
        <span className="text-small text-ink-muted">{t.dueBy(formatDateTime(session.dueBy))}</span>
      ) : null}
    </span>
  );
}

function columns(programId: string): TableColumn<CleaningSession>[] {
  return [
    {
      key: 'rank',
      header: c.rank,
      primary: true,
      cell: (row) => (
        <RowLink href={cleaningPaths.session(programId, row.id)}>
          {t.open(row.rank, row.sessionsCount)}
        </RowLink>
      ),
    },
    {
      key: 'when',
      header: c.when,
      cell: (row) => formatSlot({ start: row.scheduledStart, end: row.scheduledEnd }),
    },
    {
      key: 'status',
      header: c.status,
      cell: (row) => {
        const status = sessionStatus(row.status);
        return (
          <span className="flex flex-wrap gap-1">
            <Badge tone={status.tone} dot>
              {status.label}
            </Badge>
            {row.isRedo ? <Badge tone="neutral">{t.redo}</Badge> : null}
          </span>
        );
      },
    },
    {
      key: 'team',
      header: c.team,
      cell: (row) =>
        row.agents.length ? (
          row.agents.map((agent) => `${agent.firstName} ${agent.lastName}`).join(', ')
        ) : (
          <span className="text-ink-muted">{t.noAgent}</span>
        ),
    },
    { key: 'payment', header: c.payment, cell: (row) => <PaymentCell session={row} /> },
    { key: 'amount', header: c.amount, cell: (row) => <Amount value={row.amountDue} /> },
  ];
}

function SessionsTable({ program, filters }: { program: Program; filters: SessionFilters }) {
  const [total, setTotal] = useState<number | null>(null);
  const load = useCallback(
    async (cursor?: string) => {
      const page = await listProgramSessions(program.id, filters)(cursor);
      setTotal(page.total);
      return page;
    },
    [program.id, filters],
  );
  const list = usePagedList(load, loadErrorText);
  const filtered = Boolean(filters.status || filters.paymentStatus);
  return (
    <div className="grid gap-3">
      <p className="text-small text-ink-muted" aria-live="polite">
        {total === null ? '' : t.total(total)}
      </p>
      <ListState list={list} empty={<Note>{filtered ? t.empty : t.emptyAll}</Note>}>
        <ResponsiveTable
          caption={t.caption}
          columns={columns(program.id)}
          rows={list.items}
          rowKey={(row) => row.id}
        />
      </ListState>
    </div>
  );
}

/** Échéancier d'un programme : séances et paiements, filtrables par statut de séance et de paiement. */
export function ProgramSessions({ program }: { program: Program }) {
  const [filters, setFilters] = useState<SessionFilters>({});
  return (
    <Panel title={t.title} id="programme-seances">
      <p className="text-small text-ink-muted">{t.lead}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:max-w-2xl">
        <Choice
          id="seances-statut"
          label={t.status}
          value={filters.status ?? ''}
          all={t.all}
          options={SESSION_STATUSES.map((code) => ({ value: code, label: sessionStatus(code).label }))}
          onChange={(value) =>
            setFilters((previous) => ({
              ...previous,
              status: (value || undefined) as SessionFilters['status'],
            }))
          }
        />
        <Choice
          id="seances-paiement"
          label={t.payment}
          value={filters.paymentStatus ?? ''}
          all={t.all}
          options={PAYMENT_STATUSES.map((code) => ({ value: code, label: paymentStatus(code).label }))}
          onChange={(value) =>
            setFilters((previous) => ({
              ...previous,
              paymentStatus: (value || undefined) as SessionFilters['paymentStatus'],
            }))
          }
        />
      </div>
      <SessionsTable key={JSON.stringify(filters)} program={program} filters={filters} />
    </Panel>
  );
}
