'use client';

import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormMessage, TextField } from '@/components/ui/field';
import { type QuoteInput, sendQuote } from '@/features/cleaning/api';
import { errorStatus, errorText } from '@/features/cleaning/errors';
import { quoteTexts as t } from '@/features/cleaning/quote-texts';
import type { QuoteRequest } from '@/features/cleaning/schemas';
import { cleaningTexts } from '@/features/cleaning/texts';
import {
  type Draft,
  DraftEditor,
  EstimateNote,
  initialDraft,
  initialSlots,
  QuoteRecap,
  readDraft,
  readSlots,
  readValidity,
  type Slot,
  SlotsEditor,
  SlotsRecap,
} from './quote-parts';
import { SendDialog } from './send-dialog';

const common = cleaningTexts.common;

/**
 * Devis d'une demande (UC-CL-08) : saisie, puis récapitulatif et envoi dans une boîte (« le prix est figé à
 * l'envoi »). Sans ligne saisie, la gateway préremplit depuis le calcul de la demande : le front ne calcule
 * aucun montant et affiche seulement l'estimation déjà faite par le serveur. Route sans clé d'idempotence :
 * bouton désactivé pendant l'envoi ; après une coupure réseau, `onReread` relit la fiche.
 */
export function QuoteForm({
  request,
  onSent,
  onCancel,
  onReread,
  rereadNote,
}: {
  request: QuoteRequest;
  onSent: (request: QuoteRequest) => void;
  onCancel: () => void;
  onReread: () => void;
  rereadNote: string;
}) {
  const [draft, setDraft] = useState<Draft>(() => initialDraft(request));
  const [slots, setSlots] = useState<Slot[]>(() => initialSlots(request));
  const [validity, setValidity] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<QuoteInput | null>(null);
  const [pending, setPending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  function check(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const proposedSlots = readSlots(slots);
    if (!proposedSlots) return setError(t.slotsInvalid);
    const days = readValidity(validity);
    const part = readDraft(draft);
    if (!part.ok) return setError(part.message);
    if (!days.ok) return setError(common.invalidNumber);
    setError(null);
    setSendError(null);
    setReview({
      ...part.value,
      proposedSlots,
      ...(days.days !== undefined ? { validityDays: days.days } : {}),
    });
  }

  async function send() {
    if (!review || pending) return;
    setPending(true);
    setSendError(null);
    try {
      const next = await sendQuote(request.id, review);
      setReview(null);
      onSent(next);
    } catch (caught) {
      if (errorStatus(caught) === 0) {
        onReread();
        setSendError(`${errorText(caught)} ${rereadNote}`);
      } else {
        setSendError(errorText(caught));
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      noValidate
      onSubmit={check}
      aria-labelledby="devis-titre"
      className="bg-surface-muted rounded-card -mx-2 grid gap-5 p-3 sm:mx-0 sm:p-6"
    >
      <div>
        <h3 id="devis-titre" className="font-display text-h3 text-ink font-semibold">
          {t.title}
        </h3>
        <p className="text-small text-ink-muted mt-1">{t.text}</p>
      </div>

      <EstimateNote request={request} onUseLines={(lines) => setDraft({ ...draft, lines })} />
      <DraftEditor
        draft={draft}
        onChange={setDraft}
        idPrefix="devis"
        recommendedTeamSize={request.recommendedTeamSize}
      />
      <SlotsEditor slots={slots} onChange={setSlots} legend={t.slots} idPrefix="devis" />
      <TextField
        id="devis-validite"
        label={t.validity}
        hint={t.validityHint}
        inputMode="numeric"
        className="sm:max-w-xs"
        value={validity}
        onChange={(event) => setValidity(event.target.value)}
      />

      <FormMessage>{error}</FormMessage>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" variant="action">
          {t.review}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          {common.cancel}
        </Button>
      </div>

      <SendDialog
        open={!!review}
        title={t.send.title}
        lead={t.send.lead}
        confirmLabel={t.send.confirm}
        labels={{ back: t.send.back, pending: common.sending }}
        pending={pending}
        error={sendError}
        onConfirm={send}
        onClose={() => setReview(null)}
      >
        {review ? (
          <div className="grid gap-4">
            <QuoteRecap part={review} />
            <SlotsRecap slots={review.proposedSlots} validityDays={review.validityDays} />
            <EstimateNote request={request} />
          </div>
        ) : null}
      </SendDialog>
    </form>
  );
}
