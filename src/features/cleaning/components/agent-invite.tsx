'use client';

import { useState } from 'react';
import { FormMessage, TextField } from '@/components/ui/field';
import { Heading } from '@/components/ui/heading';
import { formatDateTime } from '@/lib/format';
import { inviteTexts } from '@/features/cleaning/agent-actions-texts';
import { inviteAgent } from '@/features/cleaning/agents-api';
import { formatPhone, toBeninE164 } from '@/features/cleaning/agents-filters';
import { cleaningPaths } from '@/features/cleaning/paths';
import { cleaningTexts } from '@/features/cleaning/texts';
import { BackLink, FormFooter, LoadingBlock, Note, Panel, useCleaningAccess, useFormSubmit } from './parts';
import { useKeyed } from './request-parts';

const t = inviteTexts;

/** Invitation par SMS (`POST /agents/invitations`, clé d'idempotence tirée au premier envoi). */
function InviteForm() {
  const [phone, setPhone] = useState('');
  const form = useFormSubmit(['phone']);
  const keyed = useKeyed();
  return (
    <form
      noValidate
      className="grid max-w-md gap-4"
      onSubmit={(event) => {
        const e164 = toBeninE164(phone);
        void form.submit(event, e164 ? {} : { phone: t.phoneInvalid }, async () => {
          const invitation = await keyed((key) => inviteAgent(e164 ?? '', key));
          setPhone('');
          return t.sent(formatPhone(invitation.phone), formatDateTime(invitation.expiresAt));
        });
      }}
    >
      <TextField
        id="phone"
        type="tel"
        label={t.phone}
        hint={t.phoneHint}
        autoComplete="off"
        value={phone}
        error={form.errors.phone}
        onChange={(event) => {
          setPhone(event.target.value);
          form.clearSuccess();
        }}
      />
      <FormFooter
        pending={form.pending}
        message={form.message}
        success={form.success}
        label={t.send}
        pendingLabel={cleaningTexts.common.sending}
      />
    </form>
  );
}

/**
 * Inviter ou créer un agent (`/nettoyage/equipe/agents/nouveau`). L'invitation par SMS est le seul
 * parcours possible depuis le back-office : la création directe exige des fichiers (photo, pièce
 * d'identité) que le back-office ne sait pas encore déposer (manque du contrat, voir le rapport).
 */
export function AgentInvite() {
  const access = useCleaningAccess();
  return (
    <div className="grid gap-4">
      <BackLink href={cleaningPaths.team}>{t.back}</BackLink>
      <Heading as="h1" size="h2">
        {t.title}
      </Heading>
      {!access ? (
        <LoadingBlock lines={4} />
      ) : access['cleaning.agent.manage'] ? (
        <>
          <Panel title={t.invite} id="agent-invitation">
            <p className="text-ink-muted max-w-reading">{t.lead}</p>
            <InviteForm />
          </Panel>
          <Panel title={t.createTitle} id="agent-creation">
            <FormMessage tone="info">{t.createText}</FormMessage>
          </Panel>
        </>
      ) : (
        <Note>{t.forbidden}</Note>
      )}
    </div>
  );
}
