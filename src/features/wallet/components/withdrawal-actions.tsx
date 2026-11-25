'use client';

import { ConfirmAction } from '@/components/ui/confirm-action';
import { TextAreaField } from '@/components/ui/select-field';
import { ApiError, apiErrorText, useSession } from '@/lib/api';
import { formatXof } from '@/lib/format';
import { approveWithdrawal, processWithdrawal, rejectWithdrawal } from '@/features/wallet/requests-api';
import type { Withdrawal } from '@/features/wallet/requests-schemas';
import { operatorName, withdrawalTexts as t } from '@/features/wallet/requests-texts';

/** Issue d'une décision : message de réussite, ou liste à relire (retrait changé entre-temps). */
export interface DecisionHandlers {
  onDone: (message: string) => void;
  onStale: () => void;
}

/** Refus du service : message lisible, et faut-il relire la liste ? */
function decisionError(error: unknown, handlers: DecisionHandlers): string {
  if (error instanceof ApiError) {
    if (error.code === 'WALLET_APPROVAL_BY_PROCESSOR') return t.errors.byProcessor;
    if (error.code === 'WALLET_WITHDRAWAL_INVALID_TRANSITION') {
      handlers.onStale();
      return t.errors.stale;
    }
    if (error.code === 'WALLET_WITHDRAWAL_NOT_FOUND') {
      handlers.onStale();
      return t.errors.notFound;
    }
  }
  return apiErrorText(error);
}

function Summary({ withdrawal, text }: { withdrawal: Withdrawal; text: string }) {
  return (
    <>
      <span className="text-ink block font-semibold">
        {t.summary(
          formatXof(withdrawal.amount),
          withdrawal.beneficiaryPhoneMasked,
          operatorName(withdrawal.beneficiaryOperator),
        )}
      </span>
      <span className="mt-2 block">{text}</span>
    </>
  );
}

/**
 * Décisions de la finance sur un retrait (R-WL-04), selon son état : `requested` → « Traiter » (note
 * des vérifications) ou « Refuser » ; `awaiting_approval` → « Valider et transmettre » par une autre
 * personne que celle qui a traité (masqué pour elle, le service refuse de toute façon) ou « Refuser ».
 * Chaque décision est confirmée ; le contrat ne prévoit pas de clé d'idempotence (transitions gardées
 * par le service, validation rejouable).
 */
export function WithdrawalActions({
  withdrawal,
  handlers,
  className,
}: {
  withdrawal: Withdrawal;
  handlers: DecisionHandlers;
  className?: string;
}) {
  const me = useSession()?.user.id;
  const amount = formatXof(withdrawal.amount);
  const { status, id } = withdrawal;
  if (status !== 'requested' && status !== 'awaiting_approval') return null;
  const ownProcessing = status === 'awaiting_approval' && withdrawal.processedBy === me;

  async function decide(run: () => Promise<unknown>, done: string): Promise<string | null> {
    try {
      await run();
      handlers.onDone(done);
      return null;
    } catch (error) {
      return decisionError(error, handlers);
    }
  }

  const reasonField = (
    <TextAreaField
      id={`retrait-motif-${id}`}
      name="value"
      label={t.reasonField}
      hint={t.reject.hint}
      rows={3}
      maxLength={500}
      required
    />
  );

  return (
    <span className={className ?? 'flex flex-wrap justify-end gap-2 md:justify-start'}>
      {status === 'requested' ? (
        <ConfirmAction
          label={t.process.label}
          accessibleLabel={t.process.accessibleLabel(amount)}
          variant="action"
          title={t.process.title}
          description={<Summary withdrawal={withdrawal} text={t.process.text} />}
          confirmLabel={t.process.submit}
          labels={t}
          onConfirm={(data) => {
            const note = String(data.get('value') ?? '').trim();
            if (!note) return Promise.resolve(t.process.required);
            return decide(() => processWithdrawal(id, note), t.process.done(amount));
          }}
        >
          <TextAreaField
            id={`retrait-note-${id}`}
            name="value"
            label={t.process.field}
            hint={t.process.hint}
            rows={3}
            maxLength={500}
            required
          />
        </ConfirmAction>
      ) : ownProcessing ? (
        <span className="text-small text-ink-muted max-w-xs">{t.ownProcessing}</span>
      ) : (
        <ConfirmAction
          label={t.approve.label}
          accessibleLabel={t.approve.accessibleLabel(amount)}
          variant="action"
          title={t.approve.title}
          description={<Summary withdrawal={withdrawal} text={t.approve.text} />}
          confirmLabel={t.approve.submit}
          labels={t}
          onConfirm={() => decide(() => approveWithdrawal(id), t.approve.done(amount))}
        />
      )}
      <ConfirmAction
        label={t.reject.label}
        accessibleLabel={t.reject.accessibleLabel(amount)}
        danger
        title={t.reject.title}
        description={<Summary withdrawal={withdrawal} text={t.reject.text} />}
        confirmLabel={t.reject.submit}
        labels={t}
        onConfirm={(data) => {
          const reason = String(data.get('value') ?? '').trim();
          if (!reason) return Promise.resolve(t.reasonRequired);
          return decide(() => rejectWithdrawal(id, reason), t.reject.done(amount));
        }}
      >
        {reasonField}
      </ConfirmAction>
    </span>
  );
}
