'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmAction } from '@/components/ui/confirm-action';
import { FormMessage } from '@/components/ui/field';
import { attempt } from '@/features/cleaning/errors';
import { quoteTexts } from '@/features/cleaning/quote-texts';
import { awaitsApproval, draftQuote } from '@/features/cleaning/request-steps';
import { approveQuoteAdjustment, sendQuote } from '@/features/cleaning/requests-api';
import type { Quote } from '@/features/cleaning/requests-schemas';
import { QuoteForm } from './request-quote-form';
import { QuoteHistory, QuoteView } from './request-quote-view';
import { confirmLabels, type StepProps, StepSection, useKeyed } from './request-parts';
import { Note } from './parts';

const t = quoteTexts;
/** Statuts où un devis peut être composé ou révisé (R-DV-05). */
const COMPOSABLE = ['visit_done', 'quote_sent'];

/** Gestes sur le brouillon : valider la remise, envoyer. */
function DraftActions({
  draft,
  onSent,
  ...props
}: StepProps & { draft: Quote; onSent: (message: string | null) => void }) {
  const { request, onRefresh, access } = props;
  const approve = useKeyed();
  const send = useKeyed();
  const pending = awaitsApproval(draft);
  const revision = request.currentQuote?.status === 'sent';
  return (
    <div className="grid gap-3">
      {pending ? (
        <Note>{access['cleaning.quote.adjust_price'] ? t.send.blocked : t.approve.reserved}</Note>
      ) : null}
      <div className="flex flex-wrap gap-3">
        {pending && access['cleaning.quote.adjust_price'] ? (
          <ConfirmAction
            label={t.approve.open}
            title={t.approve.title}
            description={t.approve.text}
            confirmLabel={t.approve.confirm}
            labels={confirmLabels}
            variant="action"
            onConfirm={() =>
              attempt(async () => {
                await approve((key) => approveQuoteAdjustment(draft.id, key));
                onRefresh();
              })
            }
          />
        ) : null}
        {pending ? null : (
          <ConfirmAction
            label={t.send.open}
            title={t.send.title}
            description={
              <>
                <p>{t.send.text}</p>
                {revision ? <p className="mt-2">{t.send.revisionText}</p> : null}
              </>
            }
            confirmLabel={t.send.confirm}
            labels={confirmLabels}
            variant="action"
            onOpen={() => onSent(null)}
            onConfirm={() =>
              attempt(async () => {
                await send((key) => sendQuote(draft.id, key));
                onSent(t.send.done);
                onRefresh();
              })
            }
          />
        )}
      </div>
    </div>
  );
}

/** Étape 4 « Devis » : devis en cours, brouillon (composer, modifier, valider, envoyer), historique. */
export function RequestQuote(props: StepProps) {
  const { request, onRefresh, access } = props;
  const [form, setForm] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const draft = draftQuote(request);
  const current = request.currentQuote;
  const canManage = access['cleaning.quote.manage'];
  const composable = canManage && COMPOSABLE.includes(request.status) && !!request.retained;
  const history = request.quoteHistory.filter((quote) => quote.id !== draft?.id && quote.id !== current?.id);
  const openLabel = draft ? t.form.edit : current?.status === 'sent' ? t.form.revise : t.form.create;
  return (
    <StepSection
      step="quote"
      title={t.title}
      action={
        composable && !form ? (
          <Button variant={draft ? 'secondary' : 'action'} onClick={() => setForm(true)}>
            {openLabel}
          </Button>
        ) : null
      }
    >
      <FormMessage tone="success">{notice}</FormMessage>
      {!request.retained && COMPOSABLE.includes(request.status) ? <Note>{t.needsRetained}</Note> : null}
      {composable && form ? (
        <QuoteForm
          {...props}
          draft={draft}
          onDone={() => {
            setForm(false);
            onRefresh();
          }}
        />
      ) : null}
      {draft ? (
        <div className="grid gap-3">
          <QuoteView quote={draft} title={t.draft} />
          {canManage ? <DraftActions {...props} draft={draft} onSent={setNotice} /> : null}
        </div>
      ) : null}
      {current ? <QuoteView quote={current} title={t.current} /> : null}
      {!draft && !current && !history.length ? <Note>{t.none}</Note> : null}
      <QuoteHistory quotes={history} />
    </StepSection>
  );
}
