'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { ConfirmAction } from '@/components/ui/confirm-action';
import { FormMessage } from '@/components/ui/field';
import { ResponsiveTable, type TableColumn } from '@/components/ui/responsive-table';
import { SelectField, TextAreaField } from '@/components/ui/select-field';
import { formatDate, formatDateTime, formatXof } from '@/lib/format';
import { usePagedList } from '@/lib/use-paged-list';
import { attempt, loadErrorText } from '@/features/recovery/errors';
import {
  type OfflinePayment,
  OFFLINE_STATUSES,
  type OfflineStatus,
} from '@/features/recovery/offline-schemas';
import {
  approveOfflinePayment,
  listOfflinePayments,
  rejectOfflinePayment,
} from '@/features/recovery/offline-api';
import { offlineSourceLabel, offlineStatus, offlineTexts } from '@/features/recovery/offline-texts';
import { recoveryPaths } from '@/features/recovery/paths';
import { actorName } from '@/features/recovery/texts';
import { confirmLabels, field } from './case-action-parts';
import { ListState, Note, useSessionUserId } from './parts';

const t = offlineTexts;
const PARAM = 'etat';
const day = (value: string) => formatDate(`${value}T12:00:00+01:00`);

/** Valider ou refuser un paiement en attente ; validation masquée pour l'auteur de la saisie (R-AR-03). */
function Decision({
  payment,
  userId,
  onChange,
}: {
  payment: OfflinePayment;
  userId: string | null;
  onChange: (payment: OfflinePayment, message: string) => void;
}) {
  if (payment.status !== 'pending_approval') return null;
  const amount = formatXof(payment.amount);
  const own = !!userId && payment.recordedBy.userId === userId;
  return (
    <div className="grid justify-items-start gap-2">
      <div className="flex flex-wrap gap-2">
        {own ? null : (
          <ConfirmAction
            label={t.approve}
            accessibleLabel={t.approveLabel(payment.caseNumber, amount)}
            title={t.approveTitle}
            description={t.approveText(amount, payment.caseNumber)}
            confirmLabel={t.approve}
            labels={confirmLabels}
            variant="action"
            onConfirm={() =>
              attempt(async () => {
                const result = await approveOfflinePayment(payment.id);
                onChange(
                  result.payment,
                  t.approved(formatXof(result.collection.gross), formatXof(result.collection.netToCreditor)),
                );
              })
            }
          />
        )}
        <ConfirmAction
          label={t.reject}
          accessibleLabel={t.rejectLabel(payment.caseNumber, amount)}
          title={t.rejectTitle}
          description={t.rejectText}
          confirmLabel={t.reject}
          labels={confirmLabels}
          danger
          onConfirm={(data) => {
            const reason = field(data, 'reason');
            if (reason.length < 3 || reason.length > 1000) return Promise.resolve(t.reasonLength);
            return attempt(async () => {
              onChange(await rejectOfflinePayment(payment.id, reason), t.rejected);
            });
          }}
        >
          <TextAreaField
            id={`refus-${payment.id}`}
            name="reason"
            label={t.reason}
            hint={t.reasonHint}
            maxLength={1000}
          />
        </ConfirmAction>
      </div>
      {own ? <span className="text-small text-ink-muted">{t.own}</span> : null}
    </div>
  );
}

/**
 * File des paiements hors ligne (`GET /recovery/offline-payments`), « À valider » par défaut, état
 * lu dans l'adresse ; validation et refus confirmés (finance, double authentification).
 */
export function OfflinePayments() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const userId = useSessionUserId();
  const raw = params.get(PARAM);
  const status: OfflineStatus | undefined =
    raw === null
      ? 'pending_approval'
      : (OFFLINE_STATUSES as readonly string[]).includes(raw)
        ? (raw as OfflineStatus)
        : undefined;
  const load = useMemo(() => listOfflinePayments({ status }), [status]);
  const list = usePagedList(load, loadErrorText);
  const [updated, setUpdated] = useState<Record<string, OfflinePayment>>({});
  const [message, setMessage] = useState<string | null>(null);
  const rows = list.items.map((payment) => updated[payment.id] ?? payment);

  const onChange = (payment: OfflinePayment, text: string) => {
    setUpdated((current) => ({ ...current, [payment.id]: payment }));
    setMessage(text);
  };

  const columns: TableColumn<OfflinePayment>[] = [
    {
      key: 'case',
      header: t.columns.case,
      primary: true,
      cell: (payment) => (
        <Link
          href={recoveryPaths.case(payment.caseId)}
          aria-label={t.open(payment.caseNumber)}
          className="text-accent-ink font-semibold underline-offset-4 hover:underline"
        >
          {payment.caseNumber}
        </Link>
      ),
    },
    {
      key: 'amount',
      header: t.columns.amount,
      cell: (payment) => <span className="tabular-nums">{formatXof(payment.amount)}</span>,
    },
    { key: 'source', header: t.columns.source, cell: (payment) => offlineSourceLabel(payment.source) },
    { key: 'received', header: t.columns.received, cell: (payment) => day(payment.receivedOn) },
    { key: 'reference', header: t.columns.reference, cell: (payment) => payment.reference ?? t.noReference },
    {
      key: 'recordedBy',
      header: t.columns.recordedBy,
      cell: (payment) => (
        <span className="grid gap-0.5">
          <span>{actorName(payment.recordedBy)}</span>
          <span className="text-small text-ink-muted">{formatDateTime(payment.createdAt)}</span>
        </span>
      ),
    },
    {
      key: 'status',
      header: t.columns.status,
      cell: (payment) => {
        const badge = offlineStatus(payment.status);
        return (
          <span className="grid justify-items-start gap-1">
            <Badge tone={badge.tone} dot>
              {badge.label}
            </Badge>
            {payment.rejectionReason ? (
              <span className="text-small">{t.rejectionReason(payment.rejectionReason)}</span>
            ) : null}
            {payment.approvedBy ? (
              <span className="text-small">{t.approvedBy(actorName(payment.approvedBy))}</span>
            ) : null}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: t.columns.actions,
      cell: (payment) => <Decision payment={payment} userId={userId} onChange={onChange} />,
    },
  ];

  const setStatus = (value: string) => {
    const next = new URLSearchParams(params.toString());
    next.set(PARAM, value || 'tous');
    router.replace(`${pathname}?${next.toString()}`);
  };

  return (
    <div className="grid gap-6">
      <SelectField
        id="paiements-etat"
        label={t.status}
        value={status ?? ''}
        className="sm:max-w-xs"
        onChange={(event) => setStatus(event.target.value)}
      >
        <option value="">{t.all}</option>
        {OFFLINE_STATUSES.map((value) => (
          <option key={value} value={value}>
            {offlineStatus(value).label}
          </option>
        ))}
      </SelectField>
      <FormMessage tone="success">{message}</FormMessage>
      <ListState list={list} empty={<Note>{t.empty}</Note>}>
        <ResponsiveTable caption={t.caption} columns={columns} rows={rows} rowKey={(payment) => payment.id} />
      </ListState>
      <Note>{t.mfa}</Note>
    </div>
  );
}
