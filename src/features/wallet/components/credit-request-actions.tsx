'use client';

import { ConfirmAction } from '@/components/ui/confirm-action';
import { TextAreaField } from '@/components/ui/select-field';
import { ApiError, apiErrorText, useSession } from '@/lib/api';
import { formatXof } from '@/lib/format';
import { approveCreditRequest, rejectCreditRequest } from '@/features/wallet/requests-api';
import type { ManualCredit } from '@/features/wallet/requests-schemas';
import { creditKind, creditRequestTexts as t } from '@/features/wallet/requests-texts';
import type { DecisionHandlers } from './withdrawal-actions';

function decisionError(error: unknown, handlers: DecisionHandlers): string {
  if (error instanceof ApiError) {
    if (error.code === 'WALLET_APPROVAL_BY_REQUESTER') return t.errors.byRequester;
    if (error.code === 'WALLET_TOP_UP_NOT_VERIFIED') return t.errors.topUpNotVerified;
    if (error.code === 'WALLET_CREDIT_REQUEST_NOT_PENDING') {
      handlers.onStale();
      return t.errors.notPending;
    }
    if (error.code === 'WALLET_CREDIT_REQUEST_NOT_FOUND') {
      handlers.onStale();
      return t.errors.notFound;
    }
  }
  return apiErrorText(error);
}

/**
 * Validation ou rejet d'une demande de crédit en attente (ADR-048). La validation est réservée à un
 * membre de la finance autre que l'auteur (masquée pour lui ; le service refuse de toute façon) ;
 * l'auteur peut rejeter sa propre demande pour l'annuler (contrat, « à valider »). Rejouable : une
 * demande déjà validée rend son crédit (`created: false`).
 */
export function CreditRequestActions({
  request,
  handlers,
  className,
}: {
  request: ManualCredit;
  handlers: DecisionHandlers;
  className?: string;
}) {
  const me = useSession()?.user.id;
  if (request.status !== 'pending_approval') return null;
  const own = request.requestedBy === me;
  const amount = formatXof(request.amount);
  const description = (text: string) => (
    <>
      <span className="text-ink block font-semibold">{t.summary(amount, creditKind(request.kind))}</span>
      <span className="mt-1 block">{request.reason}</span>
      <span className="mt-2 block">{text}</span>
    </>
  );

  return (
    <span className={className ?? 'flex flex-wrap justify-end gap-2 md:justify-start'}>
      {own ? (
        <span className="text-small text-ink-muted max-w-xs">{t.ownRequest}</span>
      ) : (
        <ConfirmAction
          label={t.approve.label}
          accessibleLabel={t.approve.accessibleLabel(amount)}
          variant="action"
          title={t.approve.title}
          description={description(t.approve.text)}
          confirmLabel={t.approve.submit}
          labels={t}
          onConfirm={async () => {
            try {
              const approval = await approveCreditRequest(request.id);
              const balance = formatXof(approval.wallet.balance);
              handlers.onDone(
                approval.created
                  ? t.approve.done(formatXof(approval.amount), balance)
                  : t.approve.already(balance),
              );
              return null;
            } catch (error) {
              return decisionError(error, handlers);
            }
          }}
        />
      )}
      <ConfirmAction
        label={t.reject.label}
        accessibleLabel={t.reject.accessibleLabel(amount)}
        danger
        title={t.reject.title}
        description={description(own ? t.reject.ownText : t.reject.text)}
        confirmLabel={t.reject.submit}
        labels={t}
        onConfirm={async (data) => {
          const reason = String(data.get('value') ?? '').trim();
          if (!reason) return t.reasonRequired;
          try {
            await rejectCreditRequest(request.id, reason);
            handlers.onDone(t.reject.done(amount));
            return null;
          } catch (error) {
            return decisionError(error, handlers);
          }
        }}
      >
        <TextAreaField
          id={`demande-credit-motif-${request.id}`}
          name="value"
          label={t.reasonField}
          hint={t.reject.hint}
          rows={3}
          maxLength={500}
          required
        />
      </ConfirmAction>
    </span>
  );
}
