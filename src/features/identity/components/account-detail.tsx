'use client';

import { useCallback, useState } from 'react';
import { BackLink } from '@/components/ui/back-link';
import { ConfirmAction } from '@/components/ui/confirm-action';
import { DescriptionList } from '@/components/ui/description-list';
import { FormMessage } from '@/components/ui/field';
import { Heading } from '@/components/ui/heading';
import { Panel } from '@/components/ui/panel';
import { ResourceView } from '@/components/ui/resource-view';
import { ResponsiveTable, type TableColumn } from '@/components/ui/responsive-table';
import { SelectField, TextAreaField } from '@/components/ui/select-field';
import { ApiError, apiErrorText } from '@/lib/api';
import { formatDate, formatDateTime } from '@/lib/format';
import { useResource } from '@/lib/use-resource';
import {
  type AccountAction,
  changeAccount,
  getAccount,
  grantRole,
  listAssignableRoles,
  revokeRole,
} from '@/features/identity/account-admin-api';
import type { AccountDetail, AuditEntry, RoleAssignment } from '@/features/identity/account-admin-schemas';
import {
  accountPaths,
  accountTexts,
  historyAction,
  personName,
  roleLabel,
  scopeLabel,
} from '@/features/identity/account-admin-texts';
import { AccountStatusBadge } from './accounts-search';

const t = accountTexts.detail;
const actions = accountTexts.actions;
const common = accountTexts.common;
const dialog = { cancel: common.cancel, pending: common.sending };

/** Le compte a changé entre-temps (autre agent) : la fiche est relue pour montrer l'état réel. */
const STALE = [
  'IDENTITY_ROLE_ALREADY_REVOKED',
  'IDENTITY_ROLE_ASSIGNMENT_NOT_FOUND',
  'IDENTITY_ACCOUNT_INVALID_TRANSITION',
  'IDENTITY_ACCOUNT_NOT_ACTIVE',
];
const isNotFound = (error: unknown) => error instanceof ApiError && error.status === 404;

type Done = (detail: AccountDetail, message: string) => void;

/** Envoie l'action ; renvoie le message d'erreur à afficher dans la boîte, ou null. */
async function run(
  action: () => Promise<AccountDetail>,
  onDone: (d: AccountDetail) => void,
  onStale: () => void,
) {
  try {
    onDone(await action());
    return null;
  } catch (error) {
    if (error instanceof ApiError && STALE.includes(error.code)) {
      onStale();
      return accountTexts.errors.stale;
    }
    return apiErrorText(error);
  }
}

function reasonOf(data: FormData): string {
  return String(data.get('reason') ?? '').trim();
}

function ReasonField({ id }: { id: string }) {
  return (
    <TextAreaField
      id={id}
      name="reason"
      label={common.reasonLabel}
      hint={common.reasonHint}
      maxLength={500}
      required
    />
  );
}

const roleName = (assignment: RoleAssignment) => roleLabel(assignment.roleCode, assignment.roleDescription);

function grantedText(assignment: RoleAssignment): string {
  const date = formatDate(assignment.grantedAt);
  return assignment.grantedBy ? t.by(assignment.grantedByName, date) : t.bootstrap(date);
}

function GrantRole({
  detail,
  onDone,
  onStale,
}: {
  detail: AccountDetail;
  onDone: Done;
  onStale: () => void;
}) {
  const catalog = useResource(listAssignableRoles);
  const held = new Set(detail.roles.filter((role) => !role.revokedAt).map((role) => role.roleCode));
  const choices =
    catalog.state.status === 'ready'
      ? catalog.state.data.filter((role) => role.grantable && !held.has(role.code))
      : [];
  const texts = actions.grant;
  return (
    <ConfirmAction
      label={texts.label}
      title={texts.title}
      description={
        <>
          <p>{texts.text}</p>
          {!detail.mfa.configured ? <p className="mt-2">{texts.mfaNotice}</p> : null}
        </>
      }
      confirmLabel={texts.confirm}
      labels={dialog}
      variant="action"
      onConfirm={async (data) => {
        const roleCode = String(data.get('role') ?? '');
        const reason = reasonOf(data);
        if (!roleCode) return texts.roleRequired;
        if (!reason) return common.reasonRequired;
        const label = roleLabel(roleCode, choices.find((role) => role.code === roleCode)?.description);
        return run(
          () => grantRole(detail.account.userId, roleCode, reason),
          (updated) => onDone(updated, texts.done(label)),
          onStale,
        );
      }}
    >
      {catalog.state.status === 'loading' ? (
        <p className="text-small text-ink-muted">{texts.loadingRoles}</p>
      ) : catalog.state.status === 'error' ? (
        <FormMessage>{apiErrorText(catalog.state.error)}</FormMessage>
      ) : choices.length ? (
        <SelectField id="compte-role" name="role" label={texts.roleLabel} defaultValue="" required>
          <option value="" disabled>
            {texts.choose}
          </option>
          {choices.map((role) => (
            <option key={role.code} value={role.code}>
              {roleLabel(role.code, role.description)} —{' '}
              {scopeLabel(role.scopeType, role.scopeType === 'domain' ? role.service : null)}
            </option>
          ))}
        </SelectField>
      ) : (
        <p className="text-small text-ink-muted">{texts.noRoleLeft}</p>
      )}
      <ReasonField id="compte-role-motif" />
    </ConfirmAction>
  );
}

function RevokeRole({
  detail,
  assignment,
  onDone,
  onStale,
}: {
  detail: AccountDetail;
  assignment: RoleAssignment;
  onDone: Done;
  onStale: () => void;
}) {
  const texts = actions.revoke;
  const name = roleName(assignment);
  return (
    <ConfirmAction
      label={texts.label}
      accessibleLabel={texts.accessible(name)}
      title={texts.title(name)}
      description={texts.text}
      confirmLabel={texts.confirm}
      labels={dialog}
      danger
      onConfirm={async (data) => {
        const reason = reasonOf(data);
        if (!reason) return common.reasonRequired;
        return run(
          () => revokeRole(detail.account.userId, assignment.id, reason),
          (updated) => onDone(updated, texts.done(name)),
          onStale,
        );
      }}
    >
      <ReasonField id={`retrait-${assignment.id}`} />
    </ConfirmAction>
  );
}

function AccountChange({
  detail,
  action,
  onDone,
  onStale,
}: {
  detail: AccountDetail;
  action: AccountAction;
  onDone: Done;
  onStale: () => void;
}) {
  const texts = actions[action];
  return (
    <ConfirmAction
      label={texts.label}
      title={texts.title}
      description={texts.text}
      confirmLabel={texts.confirm}
      labels={dialog}
      danger={action !== 'reactivate'}
      variant={action === 'reactivate' ? 'action' : undefined}
      onConfirm={async (data) => {
        const reason = reasonOf(data);
        if (!reason) return common.reasonRequired;
        return run(
          () => changeAccount(detail.account.userId, action, reason),
          (updated) => onDone(updated, texts.done),
          onStale,
        );
      }}
    >
      <ReasonField id={`compte-${action}-motif`} />
    </ConfirmAction>
  );
}

function activeColumns(
  detail: AccountDetail,
  onDone: Done,
  onStale: () => void,
): TableColumn<RoleAssignment>[] {
  return [
    {
      key: 'role',
      header: t.role,
      primary: true,
      cell: (assignment) => (
        <span className="grid">
          {roleName(assignment)}
          <span className="text-small text-ink-muted font-normal">{assignment.roleDescription}</span>
        </span>
      ),
    },
    { key: 'scope', header: t.scope, cell: (a) => scopeLabel(a.scopeType, a.scopeId) },
    { key: 'granted', header: t.granted, cell: grantedText },
    { key: 'reason', header: t.reason, cell: (a) => a.grantReason ?? t.noReason },
    {
      key: 'action',
      header: '',
      cell: (assignment) =>
        assignment.revocable ? (
          <RevokeRole detail={detail} assignment={assignment} onDone={onDone} onStale={onStale} />
        ) : null,
    },
  ];
}

const pastColumns: TableColumn<RoleAssignment>[] = [
  { key: 'role', header: t.role, primary: true, cell: roleName },
  { key: 'scope', header: t.scope, cell: (a) => scopeLabel(a.scopeType, a.scopeId) },
  { key: 'granted', header: t.granted, cell: grantedText },
  {
    key: 'revoked',
    header: t.revoked,
    cell: (a) => (a.revokedAt ? t.by(a.revokedByName, formatDate(a.revokedAt)) : null),
  },
  { key: 'reason', header: t.reason, cell: (a) => a.revokeReason ?? t.noReason },
];

const historyColumns: TableColumn<AuditEntry>[] = [
  { key: 'what', header: t.what, primary: true, cell: (e) => historyAction(e.action) },
  { key: 'when', header: t.when, cell: (e) => formatDateTime(e.at) },
  { key: 'role', header: t.role, cell: (e) => (e.roleCode ? roleLabel(e.roleCode) : t.noReason) },
  { key: 'who', header: t.who, cell: (e) => e.actorName ?? t.unknownActor },
  { key: 'reason', header: t.reason, cell: (e) => e.reason ?? t.noReason },
];

function AccountView({
  detail,
  onChange,
  onStale,
}: {
  detail: AccountDetail;
  onChange: (detail: AccountDetail) => void;
  onStale: () => void;
}) {
  const [done, setDone] = useState<string | null>(null);
  // Fiche changée entre-temps : l'explication reste sur la fiche, car la relecture peut retirer le
  // bouton et sa fenêtre (rôle déjà retiré) avant qu'elle ait affiché le message.
  const [stale, setStale] = useState<string | null>(null);
  const onDone: Done = (updated, message) => {
    setStale(null);
    setDone(message);
    onChange(updated);
  };
  const onStaleKept = () => {
    setDone(null);
    setStale(accountTexts.errors.stale);
    onStale();
  };
  const { account, mfa } = detail;
  const name = personName(account) ?? common.unnamed;
  const active = detail.roles.filter((role) => !role.revokedAt);
  const past = detail.roles.filter((role) => role.revokedAt);
  const accountActions = (['suspend', 'reactivate'] as const).filter((action) => detail.actions[action]);

  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <BackLink href={accountPaths.list}>{t.back}</BackLink>
        <div className="flex flex-wrap items-center gap-3">
          <Heading as="h1" size="h2">
            {name}
          </Heading>
          <AccountStatusBadge status={account.status} />
        </div>
        <p className="text-ink-muted">{t.created(formatDate(account.createdAt))}</p>
      </div>

      {account.status === 'suspended' ? (
        <FormMessage>
          {t.suspended(
            account.suspendedAt ? formatDate(account.suspendedAt) : null,
            account.suspensionReason,
          )}
        </FormMessage>
      ) : null}
      <FormMessage tone="success">{done}</FormMessage>
      <FormMessage tone="info">{stale}</FormMessage>

      <Panel
        title={t.rolesTitle}
        id="compte-roles"
        action={
          detail.actions.grantRole ? (
            <GrantRole detail={detail} onDone={onDone} onStale={onStaleKept} />
          ) : null
        }
      >
        {active.length ? (
          <ResponsiveTable
            caption={t.rolesCaption}
            columns={activeColumns(detail, onDone, onStaleKept)}
            rows={active}
            rowKey={(role) => role.id}
          />
        ) : (
          <p className="text-small text-ink-muted">{t.noRoles}</p>
        )}
      </Panel>

      <div className="grid gap-6 2xl:grid-cols-2">
        <Panel title={t.identityTitle} id="compte-identite">
          <DescriptionList
            items={[
              { term: t.name, value: name },
              account.phone
                ? {
                    term: t.phone,
                    value: (
                      <a
                        href={`tel:${account.phone}`}
                        className="text-accent-ink inline-flex min-h-11 items-center font-semibold tabular-nums underline"
                      >
                        {account.phone}
                      </a>
                    ),
                  }
                : { term: t.phoneMasked, value: account.phoneMasked ?? common.noPhone },
              { term: t.status, value: <AccountStatusBadge status={account.status} /> },
              { term: t.createdAt, value: formatDateTime(account.createdAt) },
            ]}
          />
        </Panel>

        <Panel
          title={t.mfaTitle}
          id="compte-double-authentification"
          action={
            detail.actions.resetMfa ? (
              <AccountChange detail={detail} action="resetMfa" onDone={onDone} onStale={onStaleKept} />
            ) : null
          }
        >
          {mfa.configured ? (
            <div className="grid gap-1">
              <p>{t.mfaConfigured(mfa.configuredAt ? formatDate(mfa.configuredAt) : null)}</p>
              <p className="text-small text-ink-muted">{t.mfaCodes(mfa.recoveryCodesRemaining)}</p>
            </div>
          ) : (
            <p className="text-ink-muted">{t.mfaMissing}</p>
          )}
        </Panel>
      </div>

      <Panel title={t.accountTitle} id="compte-acces">
        {accountActions.length ? (
          <div className="flex flex-wrap gap-3">
            {accountActions.map((action) => (
              <AccountChange
                key={action}
                detail={detail}
                action={action}
                onDone={onDone}
                onStale={onStaleKept}
              />
            ))}
          </div>
        ) : (
          <p className="text-small text-ink-muted">{t.noAccountAction}</p>
        )}
      </Panel>

      {past.length ? (
        <Panel title={t.pastTitle} id="compte-roles-retires">
          <ResponsiveTable
            caption={t.pastCaption}
            columns={pastColumns}
            rows={past}
            rowKey={(role) => role.id}
          />
        </Panel>
      ) : null}

      <Panel title={t.historyTitle} id="compte-historique">
        {detail.history.length ? (
          <ResponsiveTable
            caption={t.historyCaption}
            columns={historyColumns}
            rows={detail.history}
            rowKey={(entry) => entry.id}
          />
        ) : (
          <p className="text-small text-ink-muted">{t.noHistory}</p>
        )}
      </Panel>
    </div>
  );
}

/** Fiche d'un compte : rôles (attribuer, retirer), identité, double authentification, accès, historique. */
export function AccountDetailView({ id }: { id: string }) {
  const resource = useResource(useCallback(() => getAccount(id), [id]));
  return (
    <ResourceView
      resource={resource}
      lines={6}
      labels={common}
      describe={(error) => (isNotFound(error) ? t.notFound : apiErrorText(error))}
      retryable={(error) => !isNotFound(error)}
    >
      {(detail) => <AccountView detail={detail} onChange={resource.set} onStale={resource.refresh} />}
    </ResourceView>
  );
}
