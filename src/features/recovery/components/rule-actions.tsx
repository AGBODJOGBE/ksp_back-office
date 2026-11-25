'use client';

import { useState } from 'react';
import { ButtonLink } from '@/components/ui/button';
import { ConfirmAction } from '@/components/ui/confirm-action';
import { FormMessage } from '@/components/ui/field';
import { TextAreaField } from '@/components/ui/select-field';
import { attempt } from '@/features/recovery/errors';
import { approveRule, archiveRule, publishRule } from '@/features/recovery/pricing-api';
import type { Rule } from '@/features/recovery/pricing-schemas';
import { pricingTexts } from '@/features/recovery/pricing-texts';
import { recoveryPaths } from '@/features/recovery/paths';
import { recoveryTexts } from '@/features/recovery/texts';
import { Note } from './parts';

const t = pricingTexts.detail;
const c = recoveryTexts.common;
const labels = { cancel: c.cancel, pending: c.sending };

/**
 * Décisions sur une règle (ADR-062, décision 5) : publier un brouillon (un tarif négocié passe « À
 * valider »), valider un tarif négocié (par une autre personne que son auteur), archiver une règle
 * publiée ou en attente, créer une nouvelle version d'une règle publiée. Confirmation à chaque fois ;
 * la gateway exige une double authentification de moins de 10 minutes.
 */
export function RuleActions({
  rule,
  userId,
  onChange,
}: {
  rule: Rule;
  userId: string | null;
  onChange: (rule: Rule) => void;
}) {
  const [done, setDone] = useState<string | null>(null);
  const negotiated = !!rule.target.creditor;
  const own = !!userId && rule.createdBy.userId === userId;

  const act = (action: () => Promise<Rule>, message: (rule: Rule) => string) =>
    attempt(async () => {
      const updated = await action();
      setDone(message(updated));
      onChange(updated);
    });

  return (
    <div className="grid gap-4">
      <FormMessage tone="success">{done}</FormMessage>
      {rule.status === 'archived' ? <Note>{t.noAction}</Note> : null}
      <div className="flex flex-wrap gap-3">
        {rule.status === 'draft' ? (
          <ConfirmAction
            label={t.publish}
            title={t.publishTitle}
            description={negotiated ? t.publishNegotiated : t.publishText}
            confirmLabel={t.publish}
            labels={labels}
            variant="action"
            onConfirm={() =>
              act(
                () => publishRule(rule.id),
                (updated) => (updated.status === 'pending_approval' ? t.submitted : t.published),
              )
            }
          />
        ) : null}
        {rule.status === 'pending_approval' && !own ? (
          <ConfirmAction
            label={t.approve}
            title={t.approveTitle}
            description={t.approveText}
            confirmLabel={t.approve}
            labels={labels}
            variant="action"
            onConfirm={() =>
              act(
                () => approveRule(rule.id),
                () => t.approved,
              )
            }
          />
        ) : null}
        {rule.status === 'published' ? (
          <ButtonLink href={recoveryPaths.newVersion(rule.id)} variant="secondary">
            {t.newVersion}
          </ButtonLink>
        ) : null}
        {rule.status === 'published' || rule.status === 'pending_approval' ? (
          <ConfirmAction
            label={t.archive}
            title={t.archiveTitle}
            description={t.archiveText}
            confirmLabel={t.archive}
            labels={labels}
            danger
            onConfirm={async (data) => {
              const reason = String(data.get('motif') ?? '').trim();
              if (reason.length < 3 || reason.length > 500) return t.reasonLength;
              return act(
                () => archiveRule(rule.id, reason),
                () => t.archived,
              );
            }}
          >
            <TextAreaField
              id={`archive-${rule.id}`}
              name="motif"
              label={t.archiveReason}
              hint={t.archiveReasonHint}
              maxLength={500}
              required
            />
          </ConfirmAction>
        ) : null}
      </div>
      {rule.status === 'pending_approval' && own ? <Note>{t.ownRule}</Note> : null}
      {rule.status !== 'archived' ? <Note>{c.mfaHint}</Note> : null}
    </div>
  );
}
