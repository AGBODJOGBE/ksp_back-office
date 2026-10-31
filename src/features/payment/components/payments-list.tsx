'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { IconAlert, IconClose } from '@/components/ui/icons';
import { PagedListState } from '@/components/ui/paged-list-state';
import { ResponsiveTable, type TableColumn } from '@/components/ui/responsive-table';
import { SelectField } from '@/components/ui/select-field';
import { apiErrorText, useSession } from '@/lib/api';
import { formatDateTime, formatXof } from '@/lib/format';
import { isModuleVisible } from '@/lib/navigation/visible-modules';
import { usePagedList } from '@/lib/use-paged-list';
import { organizationPaths } from '@/features/identity/organizations';
import { listPayments, PAYMENT_STATUSES, type PaymentFilters, SUBJECT_TYPES } from '@/features/payment/api';
import type { Payment } from '@/features/payment/schemas';
import {
  failureReason,
  paymentPaths,
  paymentStatus,
  paymentTexts as t,
  providerName,
  subjectLabel,
  subjectType,
} from '@/features/payment/texts';

const MISMATCH = 'amount_mismatch';

/** Fiche de l'objet payé (adresses fixées par les fonctionnalités cleaning et billing). */
const SUBJECT_PATHS: Record<string, { module: string; path: (id: string) => string }> = {
  cleaning_mission: { module: 'nettoyage', path: (id) => `/nettoyage/missions/${encodeURIComponent(id)}` },
  billing_invoice: { module: 'finance', path: (id) => `/finance/factures/${encodeURIComponent(id)}` },
};

/** Paramètres de l'adresse (en français) → filtres de la gateway. */
const PARAMS = { status: 'etat', subjectType: 'objet-type', subjectId: 'objet' } as const;
type FilterKey = keyof typeof PARAMS;

function columns(roles: readonly string[]): TableColumn<Payment>[] {
  const visible = (module: string) => isModuleVisible(module, roles);
  return [
    {
      key: 'subject',
      header: t.columns.subject,
      primary: true,
      cell: (payment) => {
        const target = SUBJECT_PATHS[payment.subject.type];
        const label = subjectLabel(payment.subject);
        return target && visible(target.module) ? (
          <Link href={target.path(payment.subject.id)} className="stretched-link hover:underline">
            {label}
          </Link>
        ) : (
          label
        );
      },
    },
    {
      key: 'status',
      header: t.columns.status,
      cell: (payment) => {
        const status = paymentStatus(payment.status);
        return (
          <span className="grid justify-items-end gap-1 text-right md:justify-items-start md:text-left">
            <Badge tone={status.tone}>
              {payment.status === MISMATCH ? <IconAlert className="size-3.5" /> : null}
              {status.label}
            </Badge>
            {payment.failureReason ? (
              <span className="text-small text-ink-muted">
                {t.failure(failureReason(payment.failureReason))}
              </span>
            ) : null}
          </span>
        );
      },
    },
    {
      key: 'amount',
      header: t.columns.amount,
      className: 'tabular-nums font-semibold',
      cell: (payment) => formatXof(payment.amount),
    },
    {
      key: 'payer',
      header: t.columns.payer,
      cell: (payment) =>
        payment.organizationId ? (
          visible('clients') ? (
            // Lien au-dessus de la ligne cliquable : il garde son propre clic.
            <Link
              href={organizationPaths.organization(payment.organizationId)}
              className="text-accent-ink relative z-10 font-semibold underline"
            >
              {t.seeOrganization}
            </Link>
          ) : (
            t.business
          )
        ) : (
          t.individual
        ),
    },
    {
      key: 'provider',
      header: t.columns.provider,
      cell: (payment) => (
        <span className="grid">
          <span>{providerName(payment.provider)}</span>
          <span className="text-small text-ink-muted break-all">
            {payment.providerReference ? t.reference(payment.providerReference) : t.noReference}
          </span>
        </span>
      ),
    },
    { key: 'created', header: t.columns.created, cell: (payment) => formatDateTime(payment.createdAt) },
    {
      key: 'completed',
      header: t.columns.completed,
      cell: (payment) =>
        payment.completedAt
          ? formatDateTime(payment.completedAt)
          : payment.status === 'pending'
            ? t.expiresAt(formatDateTime(payment.expiresAt))
            : t.notCompleted,
    },
  ];
}

/** Alerte quand des paiements attendent l'arbitrage de la finance (`amount_mismatch`). */
function ToReviewAlert() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let active = true;
    listPayments({ status: MISMATCH }, undefined, 1).then(
      (page) => {
        if (active) setCount(page.data.length);
      },
      // L'alerte est un confort : un échec de lecture ne gêne pas la liste.
      () => undefined,
    );
    return () => {
      active = false;
    };
  }, []);
  if (!count) return null;
  return (
    <div role="status" className="rounded-card border-danger bg-danger-soft grid gap-2 border p-4">
      <p className="text-ink flex items-start gap-2 font-semibold">
        <IconAlert className="text-danger mt-1 size-4 shrink-0" />
        {t.toReview}
      </p>
      <p className="text-small text-ink">{t.toReviewHint}</p>
      <Link href={paymentPaths.toReview} className="text-ink justify-self-start font-semibold underline">
        {t.toReviewLink}
      </Link>
    </div>
  );
}

function Payments({ filters, filtered }: { filters: PaymentFilters; filtered: boolean }) {
  const { status, subjectType: type, subjectId } = filters;
  const load = useCallback(
    (cursor?: string) => listPayments({ status, subjectType: type, subjectId }, cursor),
    [status, type, subjectId],
  );
  const list = usePagedList(load, apiErrorText);
  const roles = useSession()?.roles ?? [];
  return (
    <PagedListState
      list={list}
      empty={<p className="text-small text-ink-muted">{filtered ? t.emptyFiltered : t.empty}</p>}
      labels={t}
    >
      <ResponsiveTable caption={t.caption} columns={columns(roles)} rows={list.items} rowKey={(p) => p.id} />
    </PagedListState>
  );
}

/**
 * Paiements en ligne, filtrés dans l'adresse : `?etat=`, `?objet-type=` et `?objet=` (mission ou
 * facture, depuis sa fiche). Les paiements « à examiner » sont signalés en tête de liste.
 */
export function PaymentsList() {
  const params = useSearchParams();
  const pathname = usePathname();
  const { replace } = useRouter();
  const read = (key: FilterKey) => params.get(PARAMS[key]) || undefined;
  const filters: PaymentFilters = {
    status: read('status'),
    subjectType: read('subjectType'),
    subjectId: read('subjectId'),
  };

  function update(key: FilterKey, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(PARAMS[key], value);
    else next.delete(PARAMS[key]);
    const query = next.toString();
    replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <div className="grid gap-5">
      {filters.status === MISMATCH ? null : <ToReviewAlert />}
      <div className="flex flex-wrap items-end gap-3">
        <SelectField
          id="filtre-etat-paiement"
          label={t.status}
          value={filters.status ?? ''}
          className="w-full sm:max-w-xs"
          onChange={(event) => update('status', event.target.value)}
        >
          <option value="">{t.all}</option>
          {PAYMENT_STATUSES.map((code) => (
            <option key={code} value={code}>
              {paymentStatus(code).label}
            </option>
          ))}
        </SelectField>
        <SelectField
          id="filtre-objet-paiement"
          label={t.subjectType}
          value={filters.subjectType ?? ''}
          className="w-full sm:max-w-xs"
          onChange={(event) => update('subjectType', event.target.value)}
        >
          <option value="">{t.all}</option>
          {SUBJECT_TYPES.map((code) => (
            <option key={code} value={code}>
              {subjectType(code)}
            </option>
          ))}
        </SelectField>
        {filters.subjectId ? (
          <ul aria-label={t.filters} className="flex flex-wrap gap-2">
            <li>
              <Button
                variant="secondary"
                onClick={() => update('subjectId', '')}
                aria-label={t.removeFilter(t.bySubject)}
              >
                {t.bySubject}
                <IconClose className="size-4" />
              </Button>
            </li>
          </ul>
        ) : null}
      </div>
      <Payments
        key={`${filters.status}-${filters.subjectType}-${filters.subjectId}`}
        filters={filters}
        filtered={!!(filters.status || filters.subjectType || filters.subjectId)}
      />
    </div>
  );
}
