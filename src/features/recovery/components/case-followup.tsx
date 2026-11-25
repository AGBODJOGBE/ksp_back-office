'use client';

import { ConfirmAction } from '@/components/ui/confirm-action';
import { TextField } from '@/components/ui/field';
import { SelectField, TextAreaField } from '@/components/ui/select-field';
import { beninInputToIso, isoToBeninInput } from '@/lib/format';
import { caseActionTexts } from '@/features/recovery/case-action-texts';
import {
  type Case,
  CONTACT_CHANNELS,
  CONTACT_OUTCOMES,
  type ContactChannel,
  type ContactOutcome,
  MESSAGE_CHANNELS,
  MESSAGE_TEMPLATES,
  type MessageChannel,
  type MessageTemplate,
} from '@/features/recovery/case-schemas';
import { channelLabel, directionLabel, outcomeLabel, templateLabel } from '@/features/recovery/case-texts';
import { addNote, recordContact, recordPromise, sendDebtorMessage } from '@/features/recovery/cases-api';
import { attempt } from '@/features/recovery/errors';
import { recoveryTexts } from '@/features/recovery/texts';
import {
  confirmLabels,
  DebtorSelect,
  field,
  idempotent,
  type OnDone,
  positiveAmount,
} from './case-action-parts';
import { useIdempotencyKey } from './parts';

const t = caseActionTexts;
const c = recoveryTexts.common;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function Options({ values, label }: { values: readonly string[]; label: (value: string) => string }) {
  return values.map((value) => (
    <option key={value} value={value}>
      {label(value)}
    </option>
  ));
}

/**
 * Suivi du débiteur : contact (canal, sens, issue), promesse de paiement, message par modèle validé,
 * note interne. Contact, promesse et message sont idempotents (contrat) ; la note ne l'est pas.
 */
export function CaseFollowUp({ item, onDone }: { item: Case; onDone: OnDone }) {
  const contactKey = useIdempotencyKey();
  const promiseKey = useIdempotencyKey();
  const messageKey = useIdempotencyKey();
  const now = isoToBeninInput(new Date().toISOString());
  const hasDebtor = item.debtors.length > 0;

  return (
    <div className="flex flex-wrap gap-3">
      <ConfirmAction
        label={t.contact.open}
        title={t.contact.title}
        description={t.contact.text}
        confirmLabel={c.save}
        labels={confirmLabels}
        onConfirm={(data) => {
          const occurredAt = beninInputToIso(field(data, 'occurredAt'));
          if (!occurredAt) return Promise.resolve(t.contact.invalidDate);
          const callbackRaw = field(data, 'callbackAt');
          const callbackAt = callbackRaw ? beninInputToIso(callbackRaw) : undefined;
          if (callbackAt === null) return Promise.resolve(t.contact.invalidDate);
          const note = field(data, 'note');
          const debtorId = field(data, 'debtorId');
          return attempt(async () => {
            await idempotent(contactKey, (key) =>
              recordContact(
                item.id,
                {
                  ...(debtorId ? { debtorId } : {}),
                  channel: field(data, 'channel') as ContactChannel,
                  direction: field(data, 'direction') === 'inbound' ? 'inbound' : 'outbound',
                  outcome: field(data, 'outcome') as ContactOutcome,
                  occurredAt,
                  ...(callbackAt ? { callbackAt } : {}),
                  ...(note ? { note } : {}),
                },
                key,
              ),
            );
            onDone(t.contact.saved);
          });
        }}
      >
        {hasDebtor ? (
          <DebtorSelect id="contact-debiteur" debtors={item.debtors} label={t.contact.debtor} />
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField id="contact-canal" name="channel" label={t.contact.channel} defaultValue="phone">
            <Options values={CONTACT_CHANNELS} label={channelLabel} />
          </SelectField>
          <SelectField id="contact-sens" name="direction" label={t.contact.direction} defaultValue="outbound">
            <Options values={['outbound', 'inbound']} label={directionLabel} />
          </SelectField>
        </div>
        <SelectField id="contact-issue" name="outcome" label={t.contact.outcome} defaultValue="reached">
          <Options values={CONTACT_OUTCOMES} label={outcomeLabel} />
        </SelectField>
        <TextField
          id="contact-date"
          name="occurredAt"
          type="datetime-local"
          label={t.contact.occurredAt}
          defaultValue={now}
        />
        <TextField
          id="contact-rappel"
          name="callbackAt"
          type="datetime-local"
          label={t.contact.callbackAt}
          hint={t.contact.callbackHint}
        />
        <TextAreaField id="contact-note" name="note" label={t.noteOptional} maxLength={2000} />
      </ConfirmAction>

      <ConfirmAction
        label={t.promise.open}
        title={t.promise.title}
        description={t.promise.text}
        confirmLabel={c.save}
        labels={confirmLabels}
        onConfirm={(data) => {
          const amount = positiveAmount(data, 'amount');
          if (amount === null) return Promise.resolve(c.invalidAmount);
          const dueDate = field(data, 'dueDate');
          if (!DAY.test(dueDate)) return Promise.resolve(t.promise.invalidDate);
          return attempt(async () => {
            await idempotent(promiseKey, (key) =>
              recordPromise(item.id, amount, dueDate, field(data, 'note'), key),
            );
            onDone(t.promise.saved);
          });
        }}
      >
        <TextField id="promesse-montant" name="amount" inputMode="numeric" label={t.promise.amount} />
        <TextField id="promesse-date" name="dueDate" type="date" label={t.promise.dueDate} />
        <TextAreaField id="promesse-note" name="note" label={t.noteOptional} maxLength={500} />
      </ConfirmAction>

      {hasDebtor ? (
        <ConfirmAction
          label={t.message.open}
          title={t.message.title}
          description={t.message.text}
          confirmLabel={t.message.open}
          labels={confirmLabels}
          onConfirm={(data) => {
            const channel = field(data, 'channel') as MessageChannel | '';
            return attempt(async () => {
              await idempotent(messageKey, (key) =>
                sendDebtorMessage(
                  item.id,
                  {
                    debtorId: field(data, 'debtorId'),
                    template: field(data, 'template') as MessageTemplate,
                    ...(channel ? { channel } : {}),
                  },
                  key,
                ),
              );
              onDone(t.message.sent);
            });
          }}
        >
          <DebtorSelect id="message-debiteur" debtors={item.debtors} label={t.message.debtor} />
          <SelectField id="message-modele" name="template" label={t.message.template} defaultValue="reminder">
            <Options values={MESSAGE_TEMPLATES} label={templateLabel} />
          </SelectField>
          <SelectField id="message-canal" name="channel" label={t.message.channel} defaultValue="">
            <option value="">{t.message.defaultChannel}</option>
            <Options values={MESSAGE_CHANNELS} label={channelLabel} />
          </SelectField>
        </ConfirmAction>
      ) : null}

      <ConfirmAction
        label={t.note.open}
        title={t.note.title}
        description={t.note.text}
        confirmLabel={c.save}
        labels={confirmLabels}
        onConfirm={(data) => {
          const text = field(data, 'text');
          if (!text || text.length > 4000) return Promise.resolve(t.note.length);
          return attempt(async () => {
            await addNote(item.id, text);
            onDone(t.note.saved);
          });
        }}
      >
        <TextAreaField id="note-texte" name="text" label={t.note.label} maxLength={4000} rows={5} />
      </ConfirmAction>
    </div>
  );
}
