'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/field';
import { IconAlert, IconClose } from '@/components/ui/icons';
import { PagedListState } from '@/components/ui/paged-list-state';
import { ResponsiveTable, type TableColumn } from '@/components/ui/responsive-table';
import { SelectField } from '@/components/ui/select-field';
import { apiErrorText, useSession } from '@/lib/api';
import { formatDateTime, formatXof } from '@/lib/format';
import { isModuleVisible } from '@/lib/navigation/visible-modules';
import { usePagedList } from '@/lib/use-paged-list';
import { organizationPaths } from '@/features/identity/organizations';
import { paymentAccess } from '@/features/payment/access';
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
import { ResolveMismatchAction } from './resolve-mismatch';

const MISMATCH = 'amount_mismatch';

/** Fiche de l'objet payé (adresses fixées par les fonctionnalités cleaning et billing). */
const SUBJECT_PATHS: Record<string, { module: string; path: (id: string) => string }> = {
  cleaning_mission: { module: 'nettoyage', path: (id) => `/nettoyage/missions/${encodeURIComponent(id)}` },
  billing_invoice: { module: 'finance', path: (id) => `/finance/factures/${encodeURIComponent(id)}` },
};

/** Paramètres de l'adresse (en français) → filtres de la gateway. `a-examiner=1` : `underReview=true`. */
const PARAMS = {
  status: 'etat',
  subjectType: 'objet-type',
  subjectId: 'objet',
  underReview: 'a-examiner',
} as const;
type FilterKey = keyof typeof PARAMS;

interface RowActions {
  /** Le rôle peut traiter un écart (mêmes rôles que la liste dans le contrat). */
  canResolve: boolean;
  onResolved: (payment: Payment) => void;
  onStale: () => void;
}

function columns(roles: readonly string[], actions: RowActions): TableColumn<Payment>[] {
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
            <span className="flex flex-wrap justify-end gap-1 md:justify-start">
              <Badge tone={status.tone}>
                {payment.status === MISMATCH ? <IconAlert className="size-3.5" /> : null}
                {status.label}
              </Badge>
              {payment.underReview ? (
                <Badge tone="danger" dot>
                  {t.underReview}
                </Badge>
              ) : null}
            </span>
            {payment.failureReason ? (
              <span className="text-small text-ink-muted">
                {t.failure(failureReason(payment.failureReason))}
              </span>
            ) : null}
            {payment.mismatchResolvedAt ? (
              <span className="text-small text-ink-muted">
                {t.resolvedOn(formatDateTime(payment.mismatchResolvedAt))}
                {payment.mismatchResolutionNote ? (
                  <span className="block">{t.resolutionNote(payment.mismatchResolutionNote)}</span>
                ) : null}
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
    {
      key: 'action',
      header: t.actionColumn,
      cell: (payment) =>
        payment.underReview && actions.canResolve ? (
          // Au-dessus de la ligne cliquable : le bouton garde son propre clic.
          <ResolveMismatchAction
            payment={payment}
            className="relative z-10"
            onResolved={actions.onResolved}
            onStale={actions.onStale}
          />
        ) : null,
    },
  ];
}

/** Alerte quand des écarts de montant attendent le traitement de la finance (`underReview=true`). */
function ToReviewAlert() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let active = true;
    listPayments({ underReview: true }, undefined, 1).then(
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

function Payments({
  filters,
  filtered,
  actions,
}: {
  filters: PaymentFilters;
  filtered: boolean;
  actions: RowActions;
}) {
  const { status, subjectType: type, subjectId, underReview } = filters;
  const load = useCallback(
    (cursor?: string) => listPayments({ status, subjectType: type, subjectId, underReview }, cursor),
    [status, type, subjectId, underReview],
  );
  const list = usePagedList(load, apiErrorText);
  const roles = useSession()?.roles ?? [];
  return (
    <PagedListState
      list={list}
      empty={<p className="text-small text-ink-muted">{filtered ? t.emptyFiltered : t.empty}</p>}
      labels={t}
    >
      <ResponsiveTable
        caption={t.caption}
        columns={columns(roles, actions)}
        rows={list.items}
        rowKey={(p) => p.id}
      />
    </PagedListState>
  );
}

/**
 * Paiements en ligne, filtrés dans l'adresse : `?etat=`, `?objet-type=`, `?objet=` (mission ou facture,
 * depuis sa fiche) et `?a-examiner=1` (écarts pas encore traités). Les écarts à examiner sont signalés en
 * tête de liste et se traitent sur la ligne (« Traiter l'écart »), avec un accusé de réception.
 */
export function PaymentsList() {
  const params = useSearchParams();
  const pathname = usePathname();
  const { replace } = useRouter();
  const roles = useSession()?.roles ?? [];
  const [done, setDone] = useState<string | null>(null);
  // Relecture de la liste après un traitement : la ligne quitte le filtre « à examiner ».
  const [version, setVersion] = useState(0);
  const read = (key: FilterKey) => params.get(PARAMS[key]) || undefined;
  const filters: PaymentFilters = {
    status: read('status'),
    subjectType: read('subjectType'),
    subjectId: read('subjectId'),
    underReview: read('underReview') === '1' || undefined,
  };

  function update(key: FilterKey, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(PARAMS[key], value);
    else next.delete(PARAMS[key]);
    const query = next.toString();
    setDone(null);
    replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  const actions: RowActions = {
    canResolve: paymentAccess(roles).list,
    onResolved: (payment) => {
      setDone(t.resolve.done(subjectLabel(payment.subject)));
      setVersion((value) => value + 1);
    },
    onStale: () => setVersion((value) => value + 1),
  };

  const chips = [
    filters.underReview ? { key: 'underReview' as const, label: t.underReviewFilter } : null,
    filters.subjectId ? { key: 'subjectId' as const, label: t.bySubject } : null,
  ].filter((chip) => chip !== null);

  return (
    <div className="grid gap-5">
      {filters.status === MISMATCH || filters.underReview ? null : <ToReviewAlert key={version} />}
      <FormMessage tone="success">{done}</FormMessage>
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
        {chips.length ? (
          <ul aria-label={t.filters} className="flex flex-wrap gap-2">
            {chips.map((chip) => (
              <li key={chip.key}>
                <Button
                  variant="secondary"
                  onClick={() => update(chip.key, '')}
                  aria-label={t.removeFilter(chip.label)}
                >
                  {chip.label}
                  <IconClose className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <Payments
        key={`${filters.status}-${filters.subjectType}-${filters.subjectId}-${filters.underReview}-${version}`}
        filters={filters}
        filtered={!!(filters.status || filters.subjectType || filters.subjectId || filters.underReview)}
        actions={actions}
      />
    </div>
  );
}
