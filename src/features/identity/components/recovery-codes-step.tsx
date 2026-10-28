'use client';

import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { fieldIds, FieldError } from '@/components/ui/field';
import { Heading } from '@/components/ui/heading';
import { IconAlert, IconCheck, IconCopy, IconDownload } from '@/components/ui/icons';
import { useCopy } from '@/features/identity/clipboard';
import { recoveryCodesFile } from '@/features/identity/recovery-codes';
import { identityTexts } from '@/features/identity/texts';

const CONFIRM_ID = 'codes-confirmation';

/** Fait télécharger un fichier texte créé dans la page (rien n'est envoyé à un serveur). */
function downloadText(fileName: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Remise des 10 codes de récupération, affichés une seule fois (ADR-023) : copie, téléchargement en
 * `.txt`, et confirmation explicite avant d'entrer dans le back-office. Quitter la page avant la
 * confirmation déclenche l'avertissement du navigateur.
 */
export function RecoveryCodesStep({
  codes,
  account,
  onDone,
}: {
  codes: readonly string[];
  /** Compte concerné (numéro de téléphone), écrit dans le fichier téléchargé. */
  account: string;
  onDone: () => void;
}) {
  const t = identityTexts.recovery;
  const [confirmed, setConfirmed] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [issuedAt] = useState(() => new Date());
  const confirmRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const clipboard = useCopy();
  const ids = fieldIds(CONFIRM_ID);
  const text = recoveryCodesFile(codes, account, issuedAt);

  // Arrivée sur l'écran : le titre reçoit le focus pour que l'avertissement soit lu.
  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  useEffect(() => {
    if (confirmed) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [confirmed]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!confirmed) {
      setConfirmError(t.confirmRequired);
      confirmRef.current?.focus();
      return;
    }
    onDone();
  }

  return (
    <section aria-labelledby="codes-titre" className="swap-in">
      <Heading as="h1" size="h3" id="codes-titre" className="sm:text-[1.75rem]">
        <span ref={titleRef} tabIndex={-1} className="focus:outline-none">
          {t.title}
        </span>
      </Heading>
      <p className="text-ink-muted mt-3">{t.intro}</p>
      <p className="rounded-control border-warning bg-warning-soft text-warning text-small mt-4 flex items-start gap-2 border p-4 font-medium">
        <IconAlert className="mt-0.5 size-4" />
        <span>{t.warning}</span>
      </p>

      <ol
        aria-label={t.listLabel}
        className="border-line bg-surface-muted rounded-control mt-6 grid grid-cols-2 gap-x-4 gap-y-2 border p-4 font-mono text-sm font-semibold sm:gap-x-6 sm:text-[0.9375rem] sm:tracking-wider"
      >
        {codes.map((code, index) => (
          <li key={code} className="text-ink flex items-baseline gap-2 tabular-nums">
            <span aria-hidden="true" className="text-ink-subtle w-5 text-right text-xs font-normal">
              {index + 1}
            </span>
            <span className="whitespace-nowrap select-all">{code}</span>
          </li>
        ))}
      </ol>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Button variant="secondary" onClick={() => clipboard.copy(codes.join('\n'))}>
          {clipboard.state === 'copied' ? <IconCheck /> : <IconCopy />}
          {clipboard.state === 'copied' ? t.copied : t.copy}
        </Button>
        <Button variant="secondary" onClick={() => downloadText(t.fileName, text)}>
          <IconDownload />
          {t.download}
        </Button>
      </div>
      {/* Réussite : le libellé du bouton suffit à l'œil, l'annonce reste pour les lecteurs d'écran. */}
      <p
        role="status"
        className={clipboard.state === 'failed' ? 'text-small text-ink-muted mt-2' : 'sr-only'}
      >
        {clipboard.state === 'copied' ? t.copied : clipboard.state === 'failed' ? t.copyFailed : ''}
      </p>

      <form noValidate onSubmit={submit} className="mt-6 grid gap-5">
        <div>
          <label
            htmlFor={CONFIRM_ID}
            className="rounded-control border-line-control hover-veil flex min-h-12 cursor-pointer items-start gap-3 border p-3"
          >
            <input
              ref={confirmRef}
              id={CONFIRM_ID}
              type="checkbox"
              checked={confirmed}
              onChange={(event) => {
                setConfirmed(event.target.checked);
                if (event.target.checked) setConfirmError(null);
              }}
              aria-invalid={confirmError ? true : undefined}
              aria-describedby={confirmError ? ids.error : undefined}
              className="accent-accent mt-0.5 size-5 shrink-0"
            />
            <span className="text-ink font-semibold">{t.confirm}</span>
          </label>
          {confirmError ? <FieldError id={ids.error}>{confirmError}</FieldError> : null}
        </div>
        <Button type="submit" size="lg">
          {t.continue}
        </Button>
      </form>
    </section>
  );
}
