'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { ConfirmAction } from '@/components/ui/confirm-action';
import { FormMessage, TextField } from '@/components/ui/field';
import { PagedListState } from '@/components/ui/paged-list-state';
import { ResponsiveTable, type TableColumn } from '@/components/ui/responsive-table';
import { SelectField, TextAreaField } from '@/components/ui/select-field';
import { ApiError, apiErrorText, newIdempotencyKey, useSession } from '@/lib/api';
import { formatDateTime, formatXof } from '@/lib/format';
import { usePagedList } from '@/lib/use-paged-list';
import { paymentAccess } from '@/features/payment/access';
import { listPayouts, PAYOUT_STATUSES, type PayoutOutcome, settlePayout } from '@/features/payment/api';
import {
  operatorName,
  payoutProvider,
  payoutStatus,
  payoutTexts as t,
} from '@/features/payment/payout-texts';
import type { Payout } from '@/features/payment/schemas';

/** Reversements que la finance peut encore conclure à la main ; payment tranche à chaque appel. */
const OPEN = ['requested', 'processing'];
/** Refus après lesquels la liste est relue : le reversement a changé entre-temps. */
const STALE = new Set(['PAYMENT_PAYOUT_ALREADY_SETTLED', 'PAYMENT_PAYOUT_NOT_MANUAL']);

interface Settle {
  onSettled: (payout: Payout, kind: PayoutOutcome['kind']) => void;
  onStale: () => void;
}

/**
 * « Confirmer le virement » ou « Déclarer en échec » d'un reversement manuel : champ obligatoire,
 * confirmation, clé d'idempotence tirée à l'ouverture et renvoyée telle quelle à chaque nouvel essai.
 */
function SettleAction({
  payout,
  kind,
  settle,
}: {
  payout: Payout;
  kind: PayoutOutcome['kind'];
  settle: Settle;
}) {
  const key = useRef('');
  const texts = t[kind];
  const name = payout.beneficiary.name;
  return (
    <ConfirmAction
      label={texts.label}
      accessibleLabel={texts.accessibleLabel(name)}
      variant={kind === 'confirm' ? 'action' : undefined}
      danger={kind === 'fail'}
      className="relative z-10"
      title={texts.title}
      description={
        <>
          <span className="text-ink block font-semibold">
            {t.summary(
              formatXof(payout.amount),
              name,
              payout.beneficiary.phone,
              operatorName(payout.beneficiary.operator),
            )}
          </span>
          <span className="mt-2 block">{texts.text}</span>
        </>
      }
      confirmLabel={texts.submit}
      labels={t}
      onOpen={() => {
        key.current = newIdempotencyKey();
      }}
      onConfirm={async (data) => {
        const value = String(data.get('value') ?? '').trim();
        if (!value) return texts.required;
        const outcome: PayoutOutcome =
          kind === 'confirm' ? { kind, transferReference: value } : { kind, reason: value };
        try {
          settle.onSettled(await settlePayout(payout.id, outcome, key.current), kind);
          return null;
        } catch (error) {
          if (error instanceof ApiError && STALE.has(error.code)) settle.onStale();
          return apiErrorText(error);
        }
      }}
    >
      {kind === 'confirm' ? (
        <TextField
          id={`reversement-reference-${payout.id}`}
          name="value"
          label={texts.field}
          hint={texts.hint}
          maxLength={100}
          autoComplete="off"
          required
        />
      ) : (
        <TextAreaField
          id={`reversement-raison-${payout.id}`}
          name="value"
          label={texts.field}
          hint={texts.hint}
          rows={3}
          maxLength={500}
          required
        />
      )}
    </ConfirmAction>
  );
}

function columns(settle: Settle | null): TableColumn<Payout>[] {
  return [
    {
      key: 'beneficiary',
      header: t.columns.beneficiary,
      primary: true,
      cell: (payout) => (
        <span className="grid gap-0.5">
          <span className="text-ink font-semibold">{payout.beneficiary.name}</span>
          <a
            href={`tel:${payout.beneficiary.phone}`}
            aria-label={t.call(payout.beneficiary.name)}
            className="text-accent-ink text-small tabular-nums underline"
          >
            {payout.beneficiary.phone}
          </a>
          <span className="text-small text-ink-muted">{operatorName(payout.beneficiary.operator)}</span>
        </span>
      ),
    },
    {
      key: 'amount',
      header: t.columns.amount,
      className: 'tabular-nums font-semibold',
      cell: (payout) => formatXof(payout.amount),
    },
    {
      key: 'status',
      header: t.columns.status,
      cell: (payout) => {
        const status = payoutStatus(payout.status);
        return (
          <span className="grid justify-items-end gap-1 text-right md:justify-items-start md:text-left">
            <Badge tone={status.tone}>{status.label}</Badge>
            {payout.completedAt ? (
              <span className="text-small text-ink-muted">
                {t.completedOn(formatDateTime(payout.completedAt))}
              </span>
            ) : null}
            {payout.failedAt ? (
              <span className="text-small text-ink-muted">{t.failedOn(formatDateTime(payout.failedAt))}</span>
            ) : null}
            {payout.providerReference ? (
              <span className="text-small text-ink-muted break-all">
                {t.transfer(payout.providerReference)}
              </span>
            ) : null}
            {payout.failureReason ? (
              <span className="text-small text-ink-muted">{t.failure(payout.failureReason)}</span>
            ) : null}
          </span>
        );
      },
    },
    { key: 'mode', header: t.columns.mode, cell: (payout) => payoutProvider(payout.provider) },
    { key: 'created', header: t.columns.created, cell: (payout) => formatDateTime(payout.createdAt) },
    {
      key: 'action',
      header: t.columns.action,
      cell: (payout) =>
        settle && payout.provider === 'manual' && OPEN.includes(payout.status) ? (
          <span className="flex flex-wrap justify-end gap-2 md:justify-start">
            <SettleAction payout={payout} kind="confirm" settle={settle} />
            <SettleAction payout={payout} kind="fail" settle={settle} />
          </span>
        ) : null,
    },
  ];
}

function Payouts({ status, settle }: { status?: string; settle: Settle | null }) {
  const load = useCallback((cursor?: string) => listPayouts(status, cursor), [status]);
  const list = usePagedList(load, apiErrorText);
  return (
    <PagedListState
      list={list}
      empty={<p className="text-small text-ink-muted">{status ? t.emptyFiltered : t.empty}</p>}
      labels={t}
    >
      <ResponsiveTable caption={t.caption} columns={columns(settle)} rows={list.items} rowKey={(p) => p.id} />
    </PagedListState>
  );
}

/**
 * Reversements par Mobile Money (ADR-041), filtrés par état dans l'adresse (`?etat=`). Un reversement
 * manuel encore ouvert se conclut sur sa ligne : virement confirmé avec sa référence, ou échec avec sa
 * raison (le montant est rendu au créancier). La liste est relue après chaque issue.
 */
export function PayoutsList() {
  const params = useSearchParams();
  const pathname = usePathname();
  const { replace } = useRouter();
  const roles = useSession()?.roles ?? [];
  const [done, setDone] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const status = params.get('etat') || undefined;

  function filter(value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set('etat', value);
    else next.delete('etat');
    const query = next.toString();
    setDone(null);
    replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  const settle: Settle | null = paymentAccess(roles).payouts
    ? {
        onSettled: (payout, kind) => {
          setDone(t[kind].done(formatXof(payout.amount), payout.beneficiary.name));
          setVersion((value) => value + 1);
        },
        onStale: () => setVersion((value) => value + 1),
      }
    : null;

  return (
    <div className="grid gap-5">
      <FormMessage tone="success">{done}</FormMessage>
      <SelectField
        id="filtre-etat-reversement"
        label={t.status}
        value={status ?? ''}
        className="w-full sm:max-w-xs"
        onChange={(event) => filter(event.target.value)}
      >
        <option value="">{t.all}</option>
        {PAYOUT_STATUSES.map((code) => (
          <option key={code} value={code}>
            {payoutStatus(code).label}
          </option>
        ))}
      </SelectField>
      <Payouts key={`${status}-${version}`} status={status} settle={settle} />
    </div>
  );
}
