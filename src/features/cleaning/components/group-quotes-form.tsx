'use client';

import { type FormEvent, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormMessage, TextField } from '@/components/ui/field';
import { newIdempotencyKey } from '@/lib/api';
import { type GroupQuotesInput, sendGroupQuotes } from '@/features/cleaning/api';
import { groupErrorText, serviceLabel } from '@/features/cleaning/group-errors';
import { quoteTexts as t } from '@/features/cleaning/quote-texts';
import type { GroupOutcome, QuoteRequest } from '@/features/cleaning/schemas';
import { cleaningTexts } from '@/features/cleaning/texts';
import { isQuotable } from '@/features/cleaning/workflow';
import {
  type Draft,
  DraftEditor,
  EstimateNote,
  GROUP,
  initialDraft,
  initialSlots,
  LEGEND,
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

interface Entry {
  request: QuoteRequest;
  included: boolean;
  draft: Draft;
}

/**
 * Devis groupés (`POST /admin/cleaning/quote-request-groups/{id}/quotes`, ADR-035) : créneaux communs,
 * validité, puis un bloc par demande (durée, lignes, récurrence, agents). Tout ou rien ; une erreur nomme la
 * demande en cause (`details.requestId`). Aucun total de groupe : chaque devis est chiffré à l'envoi.
 * `Idempotency-Key` tirée à l'ouverture de la boîte d'envoi, renvoyée telle quelle si l'agent renvoie.
 */
export function GroupQuotesForm({
  groupId,
  requests,
  onSent,
  onCancel,
}: {
  groupId: string;
  requests: QuoteRequest[];
  onSent: (outcome: GroupOutcome) => void;
  onCancel: () => void;
}) {
  const quotable = requests.filter(isQuotable);
  const [entries, setEntries] = useState<Entry[]>(() =>
    quotable.map((request) => ({ request, included: !request.quote, draft: initialDraft(request) })),
  );
  const [slots, setSlots] = useState<Slot[]>(() => initialSlots(quotable[0]));
  const [validity, setValidity] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<GroupQuotesInput | null>(null);
  const [pending, setPending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const key = useRef('');

  const update = (index: number, patch: Partial<Entry>) =>
    setEntries((all) => all.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));

  function check(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const proposedSlots = readSlots(slots);
    if (!proposedSlots) return setError(t.slotsInvalid);
    const days = readValidity(validity);
    if (!days.ok) return setError(common.invalidNumber);
    const chosen = entries.filter((entry) => entry.included);
    if (!chosen.length) return setError(t.group.noneSelected);
    const quotes: GroupQuotesInput['quotes'] = [];
    for (const entry of chosen) {
      const part = readDraft(entry.draft);
      if (!part.ok) return setError(`${serviceLabel(entry.request)} : ${part.message}`);
      quotes.push({ requestId: entry.request.id, ...part.value });
    }
    setError(null);
    setSendError(null);
    key.current = newIdempotencyKey();
    setReview({ proposedSlots, ...(days.days !== undefined ? { validityDays: days.days } : {}), quotes });
  }

  async function send() {
    if (!review || pending) return;
    setPending(true);
    setSendError(null);
    try {
      const outcome = await sendGroupQuotes(groupId, review, key.current);
      setReview(null);
      onSent(outcome);
    } catch (caught) {
      setSendError(groupErrorText(caught, requests));
    } finally {
      setPending(false);
    }
  }

  const byId = new Map(requests.map((request) => [request.id, request]));

  return (
    <form
      noValidate
      onSubmit={check}
      aria-labelledby="devis-groupe-titre"
      className="bg-surface-muted rounded-card -mx-2 grid gap-5 p-3 sm:mx-0 sm:p-6"
    >
      <div>
        <h3 id="devis-groupe-titre" className="font-display text-h3 text-ink font-semibold">
          {t.group.title}
        </h3>
        <p className="text-small text-ink-muted mt-1">{t.group.lead}</p>
      </div>

      <SlotsEditor slots={slots} onChange={setSlots} legend={t.commonSlots} idPrefix="devis-groupe" />
      <TextField
        id="devis-groupe-validite"
        label={t.validity}
        hint={t.validityHint}
        inputMode="numeric"
        className="sm:max-w-xs"
        value={validity}
        onChange={(event) => setValidity(event.target.value)}
      />

      {entries.map((entry, index) => {
        const service = serviceLabel(entry.request);
        return (
          <fieldset key={entry.request.id} className={`${GROUP} bg-surface`}>
            <legend className={LEGEND}>{t.group.blockTitle(service)}</legend>
            <label className="flex min-h-11 items-center gap-3">
              <input
                type="checkbox"
                checked={entry.included}
                onChange={(event) => update(index, { included: event.target.checked })}
                className="accent-brand size-5"
              />
              {t.group.include(service)}
            </label>
            {entry.included ? (
              <>
                <EstimateNote
                  request={entry.request}
                  onUseLines={(lines) => update(index, { draft: { ...entry.draft, lines } })}
                />
                <DraftEditor
                  draft={entry.draft}
                  onChange={(draft) => update(index, { draft })}
                  idPrefix={`devis-${index}`}
                  recommendedTeamSize={entry.request.recommendedTeamSize}
                />
              </>
            ) : null}
          </fieldset>
        );
      })}

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
        title={t.send.groupTitle}
        lead={t.send.groupLead}
        confirmLabel={t.send.groupConfirm(review?.quotes.length ?? 0)}
        labels={{ back: t.send.back, pending: common.sending }}
        pending={pending}
        error={sendError}
        onConfirm={send}
        onClose={() => setReview(null)}
      >
        {review ? (
          <div className="grid gap-4">
            <SlotsRecap slots={review.proposedSlots} validityDays={review.validityDays} />
            <ul className="grid gap-3">
              {review.quotes.map((quote) => {
                const request = byId.get(quote.requestId);
                return (
                  <li key={quote.requestId} className="border-line grid gap-2 border-t pt-3">
                    <QuoteRecap service={request ? serviceLabel(request) : quote.requestId} part={quote} />
                    {request ? <EstimateNote request={request} /> : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </SendDialog>
    </form>
  );
}
