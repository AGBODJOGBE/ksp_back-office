'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { ResourceView } from '@/components/ui/resource-view';
import { ResponsiveTable, type TableColumn } from '@/components/ui/responsive-table';
import { SUPER_ADMIN } from '@/config/modules';
import { apiErrorText, useSession } from '@/lib/api';
import { useResource } from '@/lib/use-resource';
import { listAssignableRoles } from '@/features/identity/account-admin-api';
import type { AssignableRole } from '@/features/identity/account-admin-schemas';
import { accountTexts, roleLabel, serviceLabel } from '@/features/identity/account-admin-texts';
import { rolePaths, roleTexts } from '@/features/identity/roles-texts';

const t = roleTexts.list;
const common = accountTexts.common;

/** Nom affiché : `name` (v2), sinon le libellé connu ou la description. */
export const assignableName = (role: AssignableRole) => role.name || roleLabel(role.code, role.description);

const columns: TableColumn<AssignableRole>[] = [
  {
    key: 'name',
    header: t.columns.name,
    primary: true,
    cell: (role) => (
      <span className="grid">
        <Link href={rolePaths.role(role.code)} className="stretched-link hover:underline">
          {assignableName(role)}
        </Link>
        <span className="text-small text-ink-muted font-mono font-normal break-all">{role.code}</span>
      </span>
    ),
  },
  {
    key: 'origin',
    header: t.columns.origin,
    cell: (role) => (role.origin ? (roleTexts.origin[role.origin] ?? role.origin) : '—'),
  },
  { key: 'service', header: t.columns.service, cell: (role) => serviceLabel(role.service) },
  {
    key: 'state',
    header: t.columns.state,
    cell: (role) => (
      <span className="flex flex-wrap gap-2">
        <Badge tone={role.active === false ? 'neutral' : 'success'} dot>
          {role.active === false ? roleTexts.state.inactive : roleTexts.state.active}
        </Badge>
        {role.sensitive ? <Badge tone="warning">{roleTexts.sensitive}</Badge> : null}
      </span>
    ),
  },
];

/** Rôles du back-office (`super_admin`) : actifs d'abord, lien vers la fiche, création. */
export function RolesList() {
  const resource = useResource(listAssignableRoles);
  // La liste est lisible par d'autres rôles (adresse directe) ; seule la création est réservée.
  const canCreate = useSession()?.roles.includes(SUPER_ADMIN) ?? false;
  return (
    <div className="grid gap-4">
      {canCreate ? (
        <div className="flex flex-wrap justify-end gap-3">
          <ButtonLink href={rolePaths.create} variant="action">
            {t.create}
          </ButtonLink>
        </div>
      ) : null}
      <ResourceView resource={resource} lines={5} labels={common} describe={apiErrorText}>
        {(roles) =>
          roles.length ? (
            <ResponsiveTable
              caption={t.caption}
              columns={columns}
              rows={[...roles].sort((a, b) => Number(a.active === false) - Number(b.active === false))}
              rowKey={(role) => role.code}
            />
          ) : (
            <p className="text-small text-ink-muted">{t.empty}</p>
          )
        }
      </ResourceView>
    </div>
  );
}
