'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import { BackLink } from '@/components/ui/back-link';
import { ConfirmAction } from '@/components/ui/confirm-action';
import { DescriptionList } from '@/components/ui/description-list';
import { FormMessage } from '@/components/ui/field';
import { Heading } from '@/components/ui/heading';
import { Panel } from '@/components/ui/panel';
import { ResourceView } from '@/components/ui/resource-view';
import { ResponsiveTable, type TableColumn } from '@/components/ui/responsive-table';
import { TextAreaField } from '@/components/ui/select-field';
import { ApiError, apiErrorText, useSession } from '@/lib/api';
import { formatDate, formatDateTime } from '@/lib/format';
import { isModuleVisible } from '@/lib/navigation/visible-modules';
import { useResource } from '@/lib/use-resource';
import type {
  AdminOrganization,
  AdminOrganizationDetail,
  OrganizationMember,
} from '@/features/identity/organization-schemas';
import {
  memberRole,
  organizationAccess,
  organizationPaths,
  organizationTexts,
} from '@/features/identity/organization-texts';
import {
  decideOrganization,
  getOrganization,
  type OrganizationDecision,
} from '@/features/identity/organizations-api';
import { OrganizationStatusBadge } from './organizations-list';

const t = organizationTexts.detail;
const actions = organizationTexts.actions;
const common = organizationTexts.common;
const dialog = { cancel: common.cancel, pending: common.sending };

/** Factures d'une organisation (adresse fixée par la fonctionnalité billing). */
const invoicesOf = (id: string) => `/finance/factures?entreprise=${encodeURIComponent(id)}`;

/** Décisions possibles dans chaque état (ADR-027) ; identity tranche à chaque appel. */
const DECISIONS: Record<string, readonly OrganizationDecision[]> = {
  pending_review: ['validate', 'reject'],
  active: ['suspend'],
  suspended: ['reactivate'],
};
const WITH_REASON: readonly OrganizationDecision[] = ['reject', 'suspend'];
const DANGER: readonly OrganizationDecision[] = ['reject', 'suspend'];

const isNotFound = (error: unknown) => error instanceof ApiError && error.status === 404;
const isInvalidTransition = (error: unknown) =>
  error instanceof ApiError && error.code === 'IDENTITY_ORGANIZATION_INVALID_TRANSITION';

const memberName = (member: OrganizationMember) =>
  [member.firstName, member.lastName].filter(Boolean).join(' ').trim() || t.unnamed;

function memberColumns(createdBy: string): TableColumn<OrganizationMember>[] {
  return [
    {
      key: 'member',
      header: t.member,
      primary: true,
      cell: (member) => (
        <span>
          {memberName(member)}
          {member.userId === createdBy ? (
            <span className="text-small text-ink-muted font-normal"> ({t.requester})</span>
          ) : null}
        </span>
      ),
    },
    { key: 'role', header: t.role, cell: (member) => memberRole(member.role) },
    {
      key: 'phone',
      header: t.phone,
      className: 'tabular-nums',
      cell: (member) =>
        member.phone ? (
          <a
            href={`tel:${member.phone}`}
            aria-label={t.call(memberName(member))}
            className="text-accent-ink inline-flex min-h-11 items-center font-semibold underline"
          >
            {member.phone}
          </a>
        ) : (
          t.noPhone
        ),
    },
    { key: 'joinedAt', header: t.joinedAt, cell: (member) => formatDate(member.joinedAt) },
  ];
}

function Decision({
  organization,
  decision,
  onDone,
  onStale,
}: {
  organization: AdminOrganization;
  decision: OrganizationDecision;
  onDone: (organization: AdminOrganization, message: string) => void;
  onStale: () => void;
}) {
  const texts = actions[decision];
  const needsReason = WITH_REASON.includes(decision);
  return (
    <ConfirmAction
      label={texts.label}
      title={texts.title}
      description={texts.text}
      confirmLabel={texts.confirm}
      labels={dialog}
      variant={decision === 'validate' || decision === 'reactivate' ? 'primary' : 'secondary'}
      danger={DANGER.includes(decision)}
      onConfirm={async (data) => {
        const reason = String(data.get('reason') ?? '').trim();
        if (needsReason && !reason) return common.reasonRequired;
        try {
          const updated = await decideOrganization(
            organization.id,
            decision,
            needsReason ? reason : undefined,
          );
          onDone(updated, texts.done);
          return null;
        } catch (error) {
          if (isInvalidTransition(error)) {
            onStale();
            return organizationTexts.errors.invalidTransition;
          }
          return apiErrorText(error);
        }
      }}
    >
      {needsReason ? (
        <TextAreaField
          id={`entreprise-motif-${decision}`}
          name="reason"
          label={common.reasonLabel}
          hint={common.reasonHint}
          maxLength={500}
          required
        />
      ) : null}
    </ConfirmAction>
  );
}

function StatusNotice({ organization }: { organization: AdminOrganization }) {
  if (organization.status === 'pending_review') return <FormMessage tone="info">{t.pending}</FormMessage>;
  if (organization.status === 'rejected' && organization.rejectionReason) {
    return <FormMessage tone="info">{t.rejected(organization.rejectionReason)}</FormMessage>;
  }
  if (organization.status === 'suspended') {
    return (
      <FormMessage>
        {t.suspended(
          organization.suspendedAt ? formatDate(organization.suspendedAt) : null,
          organization.suspensionReason,
        )}
      </FormMessage>
    );
  }
  return null;
}

function OrganizationView({
  detail,
  onChange,
  onStale,
}: {
  detail: AdminOrganizationDetail;
  onChange: (detail: AdminOrganizationDetail) => void;
  onStale: () => void;
}) {
  const roles = useSession()?.roles ?? [];
  const access = organizationAccess(roles);
  const [done, setDone] = useState<string | null>(null);
  const { organization, members } = detail;
  const decisions = DECISIONS[organization.status] ?? [];

  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <BackLink href={organizationPaths.list}>{t.back}</BackLink>
        <div className="flex flex-wrap items-center gap-3">
          <Heading as="h1" size="h2">
            {organization.legalName}
          </Heading>
          <OrganizationStatusBadge status={organization.status} />
        </div>
        <p className="text-ink-muted">{t.requested(formatDateTime(organization.createdAt))}</p>
      </div>

      <StatusNotice organization={organization} />
      <FormMessage tone="info">{done}</FormMessage>

      <Panel title={t.decisionsTitle} id="entreprise-decision">
        {!access.decide ? (
          <p className="text-small text-ink-muted">{t.decisionsReserved}</p>
        ) : decisions.length ? (
          <div className="flex flex-wrap gap-3">
            {decisions.map((decision) => (
              <Decision
                key={decision}
                organization={organization}
                decision={decision}
                onStale={onStale}
                onDone={(updated, message) => {
                  setDone(message);
                  onChange({ organization: updated, members });
                }}
              />
            ))}
          </div>
        ) : (
          <p className="text-small text-ink-muted">{t.noDecision}</p>
        )}
      </Panel>

      <div className="grid gap-6 2xl:grid-cols-2">
        <Panel
          title={t.identityTitle}
          id="entreprise-identite"
          action={
            isModuleVisible('finance', roles) ? (
              <Link
                href={invoicesOf(organization.id)}
                className="text-accent-ink text-small inline-flex min-h-11 items-center font-semibold underline"
              >
                {t.invoices}
              </Link>
            ) : null
          }
        >
          <DescriptionList
            items={[
              { term: t.legalName, value: organization.legalName },
              { term: t.address, value: organization.address },
              { term: t.ifu, value: <span className="tabular-nums">{organization.ifu}</span> },
              { term: t.rccm, value: organization.rccm ?? t.noRccm },
              { term: t.billingEmail, value: organization.billingEmail ?? t.noBillingEmail },
              { term: t.createdAt, value: formatDateTime(organization.createdAt) },
              {
                term: t.reviewedAt,
                value: organization.reviewedAt ? formatDateTime(organization.reviewedAt) : null,
              },
              {
                term: t.suspendedAt,
                value: organization.suspendedAt ? formatDateTime(organization.suspendedAt) : null,
              },
            ]}
          />
        </Panel>

        <Panel title={t.membersTitle} id="entreprise-membres">
          {members.length ? (
            <ResponsiveTable
              caption={t.membersCaption}
              columns={memberColumns(organization.createdBy)}
              rows={members}
              rowKey={(member) => member.userId}
            />
          ) : (
            <p className="text-small text-ink-muted">{t.noMembers}</p>
          )}
        </Panel>
      </div>
    </div>
  );
}

/** Fiche d'un compte entreprise : identité légale, membres, motifs, décisions du back-office. */
export function OrganizationDetail({ id }: { id: string }) {
  const resource = useResource(useCallback(() => getOrganization(id), [id]));
  return (
    <ResourceView
      resource={resource}
      lines={6}
      labels={common}
      describe={(error) => (isNotFound(error) ? t.notFound : apiErrorText(error))}
      retryable={(error) => !isNotFound(error)}
    >
      {(detail) => <OrganizationView detail={detail} onChange={resource.set} onStale={resource.refresh} />}
    </ResourceView>
  );
}
