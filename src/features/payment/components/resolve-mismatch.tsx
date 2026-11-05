'use client';

import { useRef } from 'react';
import { ConfirmAction } from '@/components/ui/confirm-action';
import { TextAreaField } from '@/components/ui/select-field';
import { ApiError, apiErrorText, newIdempotencyKey } from '@/lib/api';
import { formatXof } from '@/lib/format';
import { resolveMismatch } from '@/features/payment/api';
import type { Payment } from '@/features/payment/schemas';
import { paymentTexts, subjectLabel } from '@/features/payment/texts';

const t = paymentTexts.resolve;

/** Refus après lesquels la liste doit être relue : l'écart a été traité ailleurs entre-temps. */
const STALE = new Set(['PAYMENT_MISMATCH_ALREADY_RESOLVED', 'PAYMENT_NOT_AMOUNT_MISMATCH']);

/**
 * « Traiter l'écart » d'un paiement `amount_mismatch` encore à examiner (`underReview`) : note
 * obligatoire, confirmation, clé d'idempotence tirée à l'ouverture et renvoyée telle quelle à chaque
 * nouvel essai. `onResolved` reçoit le paiement renvoyé par la gateway ; `onStale` signale un écart déjà
 * traité ailleurs (la liste est relue).
 */
export function ResolveMismatchAction({
  payment,
  onResolved,
  onStale,
  className,
}: {
  payment: Payment;
  onResolved: (payment: Payment) => void;
  onStale?: () => void;
  className?: string;
}) {
  const key = useRef('');
  const subject = subjectLabel(payment.subject);
  return (
    <ConfirmAction
      label={t.label}
      accessibleLabel={t.accessibleLabel(subject)}
      variant="action"
      className={className}
      title={t.title}
      description={
        <>
          <span className="text-ink block font-semibold">
            {t.summary(subject, formatXof(payment.amount))}
          </span>
          <span className="mt-2 block">{t.text}</span>
        </>
      }
      confirmLabel={t.confirm}
      labels={t}
      onOpen={() => {
        key.current = newIdempotencyKey();
      }}
      onConfirm={async (data) => {
        const note = String(data.get('note') ?? '').trim();
        if (!note) return t.required;
        try {
          onResolved(await resolveMismatch(payment.id, note, key.current));
          return null;
        } catch (error) {
          if (error instanceof ApiError && STALE.has(error.code)) onStale?.();
          return apiErrorText(error);
        }
      }}
    >
      <TextAreaField
        id={`ecart-note-${payment.id}`}
        name="note"
        label={t.field}
        hint={t.hint}
        rows={4}
        maxLength={500}
        required
      />
    </ConfirmAction>
  );
}
