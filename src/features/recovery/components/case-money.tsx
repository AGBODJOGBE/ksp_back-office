'use client';

import Link from 'next/link';
import { ConfirmAction } from '@/components/ui/confirm-action';
import { TextField } from '@/components/ui/field';
import { ResponsiveTable } from '@/components/ui/responsive-table';
import { SelectField, TextAreaField } from '@/components/ui/select-field';
import { formatDateTime, formatXof } from '@/lib/format';
import type { RecoveryAccess } from '@/features/recovery/access';
import { caseActionTexts } from '@/features/recovery/case-action-texts';
import { caseDetailTexts } from '@/features/recovery/case-detail-texts';
import type { Case } from '@/features/recovery/case-schemas';
import { collectionSourceLabel } from '@/features/recovery/case-texts';
import { attempt } from '@/features/recovery/errors';
import { recordOverpaymentRefund } from '@/features/recovery/cases-api';
import { recordOfflinePayment } from '@/features/recovery/offline-api';
import { recoveryPaths } from '@/features/recovery/paths';
import { recoveryTexts, stageLabel } from '@/features/recovery/texts';
import { confirmLabels, field, idempotent, type OnDone, positiveAmount } from './case-action-parts';
import { Note, Panel, useIdempotencyKey } from './parts';

const t = caseDetailTexts.money;
const o = caseActionTexts.offline;
const f = caseActionTexts.refund;
const c = recoveryTexts.common;
const money = (value: { amount: number; currency: string }) => (
  <span className="tabular-nums">{formatXof(value)}</span>
);
const LINK =
  'text-accent-ink inline-flex min-h-11 items-center font-semibold underline-offset-4 hover:underline';

/** Saisie d'un paiement hors ligne (finance) et remboursement d'un trop-perçu : idempotents. */
function FinanceActions({ item, onDone }: { item: Case; onDone: OnDone }) {
  const offlineKey = useIdempotencyKey();
  const refundKey = useIdempotencyKey();
  const overpaid = item.amounts.overpaid.amount;
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-3">
        {item.status === 'active' || item.status === 'suspended' ? (
          <ConfirmAction
            label={o.open}
            title={o.title}
            description={o.text}
            confirmLabel={c.save}
            labels={confirmLabels}
            onConfirm={(data) => {
              const amount = positiveAmount(data, 'amount');
              if (amount === null) return Promise.resolve(c.invalidAmount);
              const receivedOn = field(data, 'receivedOn');
              if (!/^\d{4}-\d{2}-\d{2}$/.test(receivedOn)) return Promise.resolve(o.invalidDate);
              const reference = field(data, 'reference');
              return attempt(async () => {
                await idempotent(offlineKey, (key) =>
                  recordOfflinePayment(
                    item.id,
                    {
                      source: field(data, 'source') === 'transfer' ? 'transfer' : 'cash',
                      amount,
                      receivedOn,
                      ...(reference ? { reference } : {}),
                    },
                    key,
                  ),
                );
                onDone(o.saved);
              });
            }}
          >
            <SelectField id="hors-ligne-origine" name="source" label={o.source} defaultValue="cash">
              <option value="cash">{o.cash}</option>
              <option value="transfer">{o.transfer}</option>
            </SelectField>
            <TextField id="hors-ligne-montant" name="amount" inputMode="numeric" label={o.amount} />
            <TextField id="hors-ligne-date" name="receivedOn" type="date" label={o.receivedOn} />
            <TextField id="hors-ligne-reference" name="reference" label={o.reference} maxLength={100} />
          </ConfirmAction>
        ) : null}
        {overpaid > 0 ? (
          <ConfirmAction
            label={f.open}
            title={f.title}
            description={f.text(formatXof(item.amounts.overpaid))}
            confirmLabel={c.save}
            labels={confirmLabels}
            onConfirm={(data) => {
              const amount = positiveAmount(data, 'amount');
              if (amount === null) return Promise.resolve(c.invalidAmount);
              if (amount > overpaid) return Promise.resolve(f.tooHigh);
              const reference = field(data, 'reference');
              if (!reference || reference.length > 100) return Promise.resolve(f.referenceRequired);
              const note = field(data, 'note');
              return attempt(async () => {
                await idempotent(refundKey, (key) =>
                  recordOverpaymentRefund(item.id, { amount, reference, ...(note ? { note } : {}) }, key),
                );
                onDone(f.saved);
              });
            }}
          >
            <TextField
              id="trop-percu-montant"
              name="amount"
              inputMode="numeric"
              label={f.amount}
              defaultValue={String(overpaid)}
            />
            <TextField id="trop-percu-reference" name="reference" label={f.reference} maxLength={100} />
            <TextAreaField
              id="trop-percu-note"
              name="note"
              label={caseActionTexts.noteOptional}
              maxLength={500}
            />
          </ConfirmAction>
        ) : null}
      </div>
      <Note>{caseActionTexts.mfa}</Note>
    </div>
  );
}

/** Encaissements imputés, actions de la finance, liens vers les factures et la file hors ligne. */
export function CaseMoney({ item, access, onDone }: { item: Case; access: RecoveryAccess; onDone: OnDone }) {
  return (
    <Panel title={t.title} id="dossier-encaissements">
      {item.collections.length ? (
        <ResponsiveTable
          caption={t.caption}
          rows={item.collections}
          rowKey={(row) => row.id}
          columns={[
            { key: 'gross', header: t.gross, primary: true, cell: (row) => money(row.gross) },
            { key: 'date', header: t.date, cell: (row) => formatDateTime(row.receivedAt) },
            { key: 'source', header: t.source, cell: (row) => collectionSourceLabel(row.source) },
            { key: 'commission', header: t.commission, cell: (row) => money(row.commission) },
            { key: 'net', header: t.net, cell: (row) => money(row.netToCreditor) },
            { key: 'stage', header: t.stage, cell: (row) => stageLabel(row.stage) },
          ]}
        />
      ) : (
        <Note>{t.none}</Note>
      )}
      {access.offlinePayments ? <FinanceActions item={item} onDone={onDone} /> : null}
      <ul className="flex flex-wrap gap-x-6">
        {access.commissionInvoices ? (
          <li>
            <Link className={LINK} href={recoveryPaths.invoicesOf(item.creditor.id)}>
              {t.invoices}
            </Link>
          </li>
        ) : null}
        {access.offlinePayments ? (
          <li>
            <Link className={LINK} href={recoveryPaths.offlinePayments}>
              {t.offline}
            </Link>
          </li>
        ) : null}
      </ul>
    </Panel>
  );
}
