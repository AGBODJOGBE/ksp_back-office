'use client';

import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { TextAreaField } from '@/components/ui/select-field';
import { cn } from '@/lib/cn';
import { formatDateTime } from '@/lib/format';
import { updateClaim } from '@/features/cleaning/claims-api';
import type { Claim } from '@/features/cleaning/claims-schemas';
import { claimActionTexts, MAX_CLAIM_MESSAGE } from '@/features/cleaning/claims-texts';
import { errorText } from '@/features/cleaning/errors';
import { type ClaimActionProps, isClosedClaim } from './claim-actions';
import { Note } from './parts';
import { useKeyed } from './request-parts';

const t = claimActionTexts.messages;

/** Fil des échanges, dans l'ordre chronologique du contrat. */
function Thread({ claim }: { claim: Claim }) {
  if (!claim.messages.length) return <Note>{t.empty}</Note>;
  return (
    <ol className="grid gap-3">
      {claim.messages.map((message) => {
        const staff = message.author === 'staff';
        return (
          <li
            key={message.id}
            className={cn(
              'rounded-card max-w-reading grid gap-1 border p-3',
              staff ? 'border-line bg-surface-muted justify-self-end' : 'border-line',
            )}
          >
            <p className="text-small text-ink-muted">
              <span className="text-ink font-semibold">{staff ? t.staff : t.customer}</span>
              {' · '}
              {formatDateTime(message.at)}
            </p>
            <p className="break-words whitespace-pre-line">{message.text}</p>
          </li>
        );
      })}
    </ol>
  );
}

/** Réponse au client (`PATCH /claims/{id}`, champ `message`), tant que la réclamation est ouverte. */
function Reply({ claim, onChange }: Omit<ClaimActionProps, 'userId'>) {
  const keyed = useKeyed();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function send(event: FormEvent) {
    event.preventDefault();
    const message = text.trim();
    if (!message) return setError(t.required);
    if (message.length > MAX_CLAIM_MESSAGE) return setError(t.tooLong(MAX_CLAIM_MESSAGE));
    setError(null);
    setPending(true);
    try {
      onChange(await keyed((key) => updateClaim(claim.id, { message }, key)), t.done);
      setText('');
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={send} className="grid gap-3" noValidate>
      <TextAreaField
        id={`reclamation-${claim.id}-reponse`}
        label={t.label}
        hint={t.hint(MAX_CLAIM_MESSAGE)}
        error={error}
        value={text}
        rows={4}
        onChange={(event) => setText(event.target.value)}
      />
      <Button
        type="submit"
        variant="secondary"
        className="justify-self-start"
        disabled={pending}
        aria-busy={pending || undefined}
      >
        {pending ? t.sending : t.send}
      </Button>
    </form>
  );
}

/** Échanges avec le client, puis la réponse quand le compte traite les réclamations. */
export function ClaimMessages({
  claim,
  onChange,
  canManage,
}: Omit<ClaimActionProps, 'userId'> & { canManage: boolean }) {
  return (
    <div className="grid gap-4">
      <Thread claim={claim} />
      {canManage && !isClosedClaim(claim) ? <Reply claim={claim} onChange={onChange} /> : null}
    </div>
  );
}
