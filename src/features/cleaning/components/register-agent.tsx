'use client';

import { type KeyboardEvent, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmAction } from '@/components/ui/confirm-action';
import { TextField } from '@/components/ui/field';
import {
  type AccountMatch,
  accountLookupError,
  accountName,
  DEFAULT_COUNTRY_CODE,
  findAccountByPhone,
  toE164,
} from '@/features/identity';
import { registerAgent } from '@/features/cleaning/api';
import { attempt, errorText } from '@/features/cleaning/errors';
import type { Agent } from '@/features/cleaning/schemas';
import { teamTexts } from '@/features/cleaning/team-texts';
import { cleaningTexts } from '@/features/cleaning/texts';

const t = teamTexts.register;
const common = cleaningTexts.common;

const value = (data: FormData, name: string) => String(data.get(name) ?? '').trim();

/**
 * Étape de recherche : l'admin saisit un numéro, voit le compte trouvé (nom, numéro masqué, état) et
 * corrige au besoin le nom affiché. Le compte choisi part dans le formulaire (`agentId`, caché).
 */
function AccountLookup() {
  const [phone, setPhone] = useState('');
  const [match, setMatch] = useState<AccountMatch | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  async function search() {
    if (searching) return;
    const e164 = toE164(DEFAULT_COUNTRY_CODE, phone);
    if (!e164) {
      setError(t.phoneInvalid);
      return;
    }
    setSearching(true);
    setError(null);
    setMatch(null);
    try {
      setMatch(await findAccountByPhone(e164));
    } catch (caught) {
      setError(accountLookupError(caught) ?? errorText(caught));
    } finally {
      setSearching(false);
    }
  }

  // Entrée dans le champ du numéro lance la recherche, pas le rattachement.
  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    void search();
  }

  if (match) {
    const name = accountName(match);
    const status = t.statuses[match.status as keyof typeof t.statuses] ?? match.status;
    return (
      <div className="grid gap-4">
        <input type="hidden" name="agentId" value={match.userId} />
        <div className="rounded-card border-line bg-surface-muted grid gap-1 border p-4" role="status">
          <p className="text-small text-ink-muted">{t.found}</p>
          <p className="text-ink font-semibold">{name ?? t.noName}</p>
          <p className="text-ink-muted tabular-nums">{match.phoneMasked}</p>
          <div>
            <Badge tone={match.status === 'active' ? 'success' : 'warning'}>{status}</Badge>
          </div>
        </div>
        {match.status === 'active' ? null : <p className="text-small text-ink-muted">{t.notActive}</p>}
        <TextField
          id="agent-nom"
          name="displayName"
          label={t.displayName}
          hint={t.displayNameHint}
          defaultValue={name ?? ''}
          maxLength={100}
          required
        />
        <Button variant="ghost" className="justify-self-start" onClick={() => setMatch(null)}>
          {t.otherNumber}
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <TextField
        id="agent-telephone"
        type="tel"
        label={t.phone}
        hint={t.phoneHint}
        autoComplete="off"
        inputMode="tel"
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
        onKeyDown={onKeyDown}
        error={error}
      />
      <Button
        variant="secondary"
        className="justify-self-start"
        onClick={() => void search()}
        aria-busy={searching || undefined}
        disabled={searching || !phone.trim()}
      >
        {searching ? t.searching : t.search}
      </Button>
    </div>
  );
}

/**
 * Rattacher un compte KSP comme agent : recherche par numéro de téléphone (identity, ADR-029), puis
 * confirmation. La recherche repart de zéro à chaque ouverture.
 */
export function RegisterAgentDialog({ onDone }: { onDone: (agent: Agent) => void }) {
  const [round, setRound] = useState(0);
  return (
    <ConfirmAction
      label={t.label}
      variant="primary"
      title={t.title}
      description={t.text}
      confirmLabel={t.confirm}
      labels={{ cancel: common.cancel, pending: common.sending }}
      onOpen={() => setRound((current) => current + 1)}
      onConfirm={async (form) => {
        const agentId = value(form, 'agentId');
        const displayName = value(form, 'displayName');
        if (!agentId) return t.searchFirst;
        if (!displayName) return `${t.displayName} : ${common.required}`;
        return attempt(async () => onDone(await registerAgent({ agentId, displayName })));
      }}
    >
      <AccountLookup key={round} />
    </ConfirmAction>
  );
}
