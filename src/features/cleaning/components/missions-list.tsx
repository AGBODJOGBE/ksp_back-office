'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { PagedListState } from '@/components/ui/paged-list-state';
import { ResponsiveTable, type TableColumn } from '@/components/ui/responsive-table';
import { SelectField } from '@/components/ui/select-field';
import { formatSlot, formatXof } from '@/lib/format';
import { usePagedList } from '@/lib/use-paged-list';
import { listMissions } from '@/features/cleaning/api';
import { errorText } from '@/features/cleaning/errors';
import { missionsTexts as t } from '@/features/cleaning/mission-texts';
import { cleaningPaths } from '@/features/cleaning/paths';
import type { Mission } from '@/features/cleaning/schemas';
import { cleaningTexts, missionStatuses, paymentStatuses } from '@/features/cleaning/texts';
import { Note, StatusBadge } from './parts';
import { useServiceName } from './use-service-names';

const common = cleaningTexts.common;

const columns = (serviceName: (code: string) => string): TableColumn<Mission>[] => [
  {
    key: 'mission',
    header: t.columns.mission,
    primary: true,
    cell: (mission) => (
      <Link href={cleaningPaths.mission(mission.id)} className="stretched-link hover:underline">
        {t.open(serviceName(mission.serviceCode), mission.commune)}
      </Link>
    ),
  },
  {
    key: 'status',
    header: t.columns.status,
    cell: (mission) => <StatusBadge map={missionStatuses} code={mission.status} />,
  },
  { key: 'slot', header: t.columns.slot, cell: (mission) => formatSlot(mission.chosenSlot) },
  {
    key: 'progress',
    header: t.columns.progress,
    className: 'tabular-nums',
    cell: (mission) => t.progress(mission.completedInterventions, mission.plannedInterventions),
  },
  {
    key: 'payment',
    header: t.columns.payment,
    className: 'tabular-nums',
    cell: (mission) => (
      <span className="inline-flex flex-wrap items-center gap-2">
        <StatusBadge map={paymentStatuses} code={mission.payment.status} />
        {formatXof(mission.payment.paid)} / {formatXof(mission.payment.total)}
      </span>
    ),
  },
];

function Missions({ status }: { status: string }) {
  const load = useCallback((cursor?: string) => listMissions(status || undefined, cursor), [status]);
  const list = usePagedList(load, errorText);
  const serviceName = useServiceName();
  return (
    <PagedListState list={list} empty={<Note>{t.empty}</Note>} labels={common}>
      <ResponsiveTable
        caption={t.caption}
        columns={columns(serviceName)}
        rows={list.items}
        rowKey={(mission) => mission.id}
      />
    </PagedListState>
  );
}

/** Missions, filtrées par état dans l'adresse (`?etat=`). Un agent seul ne reçoit que ses missions (gateway). */
export function MissionsList() {
  const params = useSearchParams();
  const pathname = usePathname();
  const { replace } = useRouter();
  const status = params.get('etat') ?? '';
  return (
    <div className="grid gap-5">
      <SelectField
        id="filtre-etat-mission"
        label={t.columns.status}
        value={status}
        className="sm:max-w-xs"
        onChange={(event) => {
          const value = event.target.value;
          replace(value ? `${pathname}?etat=${encodeURIComponent(value)}` : pathname, { scroll: false });
        }}
      >
        <option value="">{common.all}</option>
        {Object.entries(missionStatuses).map(([code, entry]) => (
          <option key={code} value={code}>
            {entry.label}
          </option>
        ))}
      </SelectField>
      <Missions key={status || 'all'} status={status} />
    </div>
  );
}
