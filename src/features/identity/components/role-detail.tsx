'use client';

import { useCallback, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { BackLink } from '@/components/ui/back-link';
import { Button } from '@/components/ui/button';
import { DescriptionList } from '@/components/ui/description-list';
import { FormMessage } from '@/components/ui/field';
import { Heading } from '@/components/ui/heading';
import { Panel } from '@/components/ui/panel';
import { ResourceView } from '@/components/ui/resource-view';
import { ApiError, apiErrorText } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useResource } from '@/lib/use-resource';
import { accountTexts, scopeLabel, serviceLabel } from '@/features/identity/account-admin-texts';
import { getRole, listPermissions } from '@/features/identity/roles-api';
import { retiredPermissions } from '@/features/identity/roles-logic';
import type { ManagedRole, Permission } from '@/features/identity/roles-schemas';
import { rolePaths, roleTexts } from '@/features/identity/roles-texts';
import { DeactivateRole, type RoleCallbacks, SaveRole } from './role-actions';
import { draftOf, type RoleDraft, RoleFields } from './role-fields';
import { RolePermissionsList } from './role-permissions';

const t = roleTexts.detail;
const common = accountTexts.common;
const isNotFound = (error: unknown) => error instanceof ApiError && error.status === 404;
const when = (date: string | null) => (date ? t.at(formatDateTime(date)) : null);

export function RoleBadges({ role }: { role: Pick<ManagedRole, 'active' | 'sensitive'> }) {
  return (
    <>
      <Badge tone={role.active ? 'success' : 'neutral'} dot>
        {role.active ? roleTexts.state.active : roleTexts.state.inactive}
      </Badge>
      {role.sensitive ? <Badge tone="warning">{roleTexts.sensitive}</Badge> : null}
    </>
  );
}

function RoleInfo({ role }: { role: ManagedRole }) {
  return (
    <DescriptionList
      items={[
        { term: t.code, value: <span className="font-mono break-all">{role.code}</span> },
        { term: t.origin, value: roleTexts.origin[role.origin] ?? role.origin },
        { term: t.service, value: serviceLabel(role.service) },
        { term: t.scope, value: scopeLabel(role.scopeType, null) },
        { term: t.access, value: t.accessValue(role.backofficeAccess, role.requiresMfa) },
        { term: t.sensitiveTerm, value: t.sensitiveValue(role.sensitive) },
        { term: t.assignments, value: t.assignmentsValue(role.activeAssignments) },
        { term: t.created, value: when(role.createdAt) },
        ...(role.updatedAt ? [{ term: t.updated, value: when(role.updatedAt) }] : []),
        ...(role.deactivatedAt ? [{ term: t.deactivated, value: when(role.deactivatedAt) }] : []),
      ]}
    />
  );
}

function RoleView({
  role,
  catalog,
  callbacks,
  message,
}: {
  role: ManagedRole;
  catalog: readonly Permission[] | null;
  callbacks: RoleCallbacks;
  message: string | null;
}) {
  const [draft, setDraft] = useState<RoleDraft | null>(null);
  const editable = role.editable && role.active;
  const retired = catalog ? retiredPermissions(role.permissions, catalog) : [];
  const saved: RoleCallbacks = {
    ...callbacks,
    onSaved: (updated, text) => {
      setDraft(null);
      callbacks.onSaved(updated, text);
    },
  };

  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <BackLink href={rolePaths.list}>{t.back}</BackLink>
        <div className="flex flex-wrap items-center gap-3">
          <Heading as="h1" size="h2">
            {role.name}
          </Heading>
          <RoleBadges role={role} />
        </div>
        {role.description ? <p className="text-ink-muted max-w-reading">{role.description}</p> : null}
      </div>

      <FormMessage tone="success">{message}</FormMessage>
      {!role.editable ? <FormMessage tone="info">{t.notEditable}</FormMessage> : null}
      {role.editable && !role.active ? <FormMessage tone="info">{t.inactive}</FormMessage> : null}

      <Panel
        title={t.infoTitle}
        id="role-fiche"
        action={editable && !draft ? <DeactivateRole role={role} callbacks={saved} /> : null}
      >
        <RoleInfo role={role} />
      </Panel>

      <Panel
        title={t.permissionsTitle}
        id="role-permissions"
        action={
          editable && !draft && catalog ? (
            <Button variant="secondary" onClick={() => setDraft(draftOf(role))}>
              {t.edit}
            </Button>
          ) : null
        }
      >
        {retired.length ? <FormMessage tone="info">{t.retiredNotice(retired.length)}</FormMessage> : null}
        {!catalog ? (
          // Catalogue pas encore lu (ou en échec, signalé en haut de la fiche) : les codes bruts.
          <div className="grid gap-2">
            <p className="text-small text-ink-muted">{t.loadingCatalog}</p>
            <ul className="text-small grid gap-1 font-mono break-all">
              {role.permissions.map((code) => (
                <li key={code}>{code}</li>
              ))}
            </ul>
          </div>
        ) : draft ? (
          <div className="grid gap-5">
            <RoleFields draft={draft} onChange={setDraft} catalog={catalog} />
            <div className="flex flex-wrap justify-end gap-3">
              <Button variant="ghost" onClick={() => setDraft(null)}>
                {roleTexts.form.cancel}
              </Button>
              <SaveRole role={role} draft={draft} catalog={catalog} callbacks={saved} />
            </div>
          </div>
        ) : (
          <>
            <p className="text-small text-ink-muted">{t.permissionsCount(role.permissions.length)}</p>
            <RolePermissionsList catalog={catalog} granted={role.permissions} />
          </>
        )}
      </Panel>
    </div>
  );
}

/** Fiche d'un rôle (`super_admin`) : informations, permissions cochées, modification, désactivation. */
export function RoleDetailView({ code }: { code: string }) {
  const resource = useResource(useCallback(() => getRole(code), [code]));
  // Retirées comprises : la fiche signale les permissions qu'un service ne déclare plus.
  const catalog = useResource(useCallback(() => listPermissions(true), []));
  const [message, setMessage] = useState<string | null>(null);
  const callbacks: RoleCallbacks = {
    onSaved: (role, text) => {
      setMessage(text);
      resource.set(role);
    },
    onStale: () => {
      setMessage(null);
      resource.refresh();
    },
    onCatalogStale: catalog.refresh,
  };
  return (
    <ResourceView
      resource={resource}
      lines={6}
      labels={common}
      describe={(error) => (isNotFound(error) ? t.notFound : apiErrorText(error))}
      retryable={(error) => !isNotFound(error)}
    >
      {(role) => (
        <>
          {catalog.state.status === 'error' ? (
            <div className="mb-6 grid justify-items-start gap-3">
              <FormMessage>{apiErrorText(catalog.state.error)}</FormMessage>
              <Button variant="secondary" onClick={catalog.reload}>
                {common.retry}
              </Button>
            </div>
          ) : null}
          <RoleView
            role={role}
            catalog={catalog.state.status === 'ready' ? catalog.state.data : null}
            callbacks={callbacks}
            message={message}
          />
        </>
      )}
    </ResourceView>
  );
}
