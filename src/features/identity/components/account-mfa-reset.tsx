'use client';

import { ConfirmAction } from '@/components/ui/confirm-action';
import { TextAreaField } from '@/components/ui/select-field';
import { ApiError, apiErrorText } from '@/lib/api';
import { changeAccount } from '@/features/identity/account-admin-api';
import type { AccountDetail } from '@/features/identity/account-admin-schemas';
import { accountTexts, personName } from '@/features/identity/account-admin-texts';

const texts = accountTexts.actions.resetMfa;
const common = accountTexts.common;
const errors = accountTexts.errors;

/**
 * Réinitialisation de la double authentification d'un compte (`POST /accounts/{id}/mfa/reset`,
 * `super_admin`, ADR-043) : confirmation forte (identité vérifiée cochée, motif obligatoire, bouton
 * rouge). La route n'a pas de clé d'idempotence : un second envoi est refusé par identity
 * (`IDENTITY_MFA_NOT_ENROLLED`), ce qui relit la fiche et l'explique.
 */
export function ResetMfa({
  detail,
  onDone,
  onStale,
}: {
  detail: AccountDetail;
  onDone: (detail: AccountDetail, message: string) => void;
  onStale: (message: string) => void;
}) {
  const name = personName(detail.account);
  return (
    <ConfirmAction
      label={texts.label}
      accessibleLabel={`${texts.label} la double authentification`}
      title={name ? texts.titleFor(name) : texts.title}
      description={texts.text}
      confirmLabel={texts.confirm}
      labels={{ cancel: common.cancel, pending: common.sending }}
      danger
      onConfirm={async (data) => {
        if (data.get('identityChecked') !== 'on') return texts.checkRequired;
        const reason = String(data.get('reason') ?? '').trim();
        if (!reason) return common.reasonRequired;
        try {
          onDone(await changeAccount(detail.account.userId, 'resetMfa', reason), texts.done);
          return null;
        } catch (error) {
          if (error instanceof ApiError && error.code === 'IDENTITY_MFA_NOT_ENROLLED') {
            onStale(errors.mfaNotEnrolled);
            return errors.mfaNotEnrolled;
          }
          if (error instanceof ApiError && error.code === 'IDENTITY_SELF_ACTION_FORBIDDEN') {
            return errors.selfAction;
          }
          return apiErrorText(error);
        }
      }}
    >
      <div className="flex min-h-11 items-start gap-3">
        <input
          id="mfa-reset-identite"
          type="checkbox"
          name="identityChecked"
          required
          className="accent-action mt-1 size-5 shrink-0"
        />
        <label htmlFor="mfa-reset-identite" className="text-ink font-semibold">
          {texts.check}
        </label>
      </div>
      <TextAreaField
        id="mfa-reset-motif"
        name="reason"
        label={common.reasonLabel}
        hint={common.reasonHint}
        maxLength={500}
        required
      />
    </ConfirmAction>
  );
}
