'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { PagedListState } from '@/components/ui/paged-list-state';
import { ResponsiveTable, type TableColumn } from '@/components/ui/responsive-table';
import { SelectField } from '@/components/ui/select-field';
import { apiErrorText } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { usePagedList } from '@/lib/use-paged-list';
import type { AdminOrganization } from '@/features/identity/organization-schemas';
import {
  organizationPaths,
  organizationStatus,
  organizationTexts,
} from '@/features/identity/organization-texts';
import { listOrganizations, ORGANIZATION_STATUSES } from '@/features/identity/organizations-api';

const t = organizationTexts.list;
const common = organizationTexts.common;

export function OrganizationStatusBadge({ status }: { status: string }) {
  const { label, tone } = organizationStatus(status);
  return <Badge tone={tone}>{label}</Badge>;
}

const columns: TableColumn<AdminOrganization>[] = [
  {
    key: 'legalName',
    header: t.columns.legalName,
    primary: true,
    cell: (organization) => (
      <Link href={organizationPaths.organization(organization.id)} className="stretched-link hover:underline">
        {organization.legalName}
      </Link>
    ),
  },
  {
    key: 'status',
    header: t.columns.status,
    cell: (organization) => <OrganizationStatusBadge status={organization.status} />,
  },
  { key: 'ifu', header: t.columns.ifu, className: 'tabular-nums', cell: (organization) => organization.ifu },
  {
    key: 'createdAt',
    header: t.columns.createdAt,
    cell: (organization) => formatDate(organization.createdAt),
  },
  {
    key: 'reviewedAt',
    header: t.columns.reviewedAt,
    cell: (organization) => (organization.reviewedAt ? formatDate(organization.reviewedAt) : t.noDecision),
  },
];

function Organizations({ status }: { status: string }) {
  const load = useCallback((cursor?: string) => listOrganizations(status || undefined, cursor), [status]);
  const list = usePagedList(load, apiErrorText);
  return (
    <PagedListState
      list={list}
      empty={<p className="text-small text-ink-muted">{status ? t.emptyFiltered : t.empty}</p>}
      labels={common}
    >
      <ResponsiveTable caption={t.caption} columns={columns} rows={list.items} rowKey={(o) => o.id} />
    </PagedListState>
  );
}

/** Comptes entreprise, filtrés par état dans l'adresse (`?etat=pending_review` : demandes à traiter). */
export function OrganizationsList() {
  const params = useSearchParams();
  const pathname = usePathname();
  const { replace } = useRouter();
  const status = params.get('etat') ?? '';
  return (
    <div className="grid gap-5">
      <SelectField
        id="filtre-etat-entreprise"
        label={t.status}
        value={status}
        className="sm:max-w-xs"
        onChange={(event) => {
          const value = event.target.value;
          replace(value ? `${pathname}?etat=${encodeURIComponent(value)}` : pathname, { scroll: false });
        }}
      >
        <option value="">{common.all}</option>
        {ORGANIZATION_STATUSES.map((code) => (
          <option key={code} value={code}>
            {organizationStatus(code).label}
          </option>
        ))}
      </SelectField>
      <Organizations key={status || 'all'} status={status} />
    </div>
  );
}
