'use client';

import Link from 'next/link';
import { type FormEvent, useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormMessage, TextField } from '@/components/ui/field';
import { Panel } from '@/components/ui/panel';
import { ResourceView } from '@/components/ui/resource-view';
import { apiErrorText } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useResource } from '@/lib/use-resource';
import { getBillingSettings, updateBillingSettings } from '@/features/billing/api';
import type { BillingSettings } from '@/features/billing/schemas';
import { billingTexts } from '@/features/billing/texts';
import { useBillingAccess } from './parts';

const t = billingTexts.settings;
const common = billingTexts.common;

function TermForm({
  settings,
  onSaved,
}: {
  settings: BillingSettings;
  onSaved: (s: BillingSettings) => void;
}) {
  const [value, setValue] = useState(String(settings.paymentTermDays));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setSaved(false);
    const days = Number(value);
    // Bornes du contrat (1 à 90) : contrôle de saisie seulement, la gateway revérifie.
    if (!/^\d+$/.test(value.trim()) || days < 1 || days > 90) {
      setError(t.invalid);
      return;
    }
    setPending(true);
    setError(null);
    try {
      const updated = await updateBillingSettings(days);
      onSaved(updated);
      setValue(String(updated.paymentTermDays));
      setSaved(true);
    } catch (caught) {
      setError(apiErrorText(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <form noValidate onSubmit={submit} className="grid gap-4">
      <p className="text-ink">{t.current(settings.paymentTermDays)}</p>
      <p className="text-small text-ink-muted">
        {settings.updatedAt ? t.updated(formatDateTime(settings.updatedAt)) : t.neverUpdated}
      </p>
      <TextField
        id="reglage-delai"
        name="paymentTermDays"
        label={t.term}
        hint={t.termHint}
        inputMode="numeric"
        className="max-w-xs"
        value={value}
        error={error}
        onChange={(event) => setValue(event.target.value)}
      />
      <FormMessage tone="info">{saved ? t.saved : null}</FormMessage>
      <Button
        type="submit"
        className="justify-self-start"
        disabled={pending}
        aria-busy={pending || undefined}
      >
        {pending ? common.saving : t.save}
      </Button>
    </form>
  );
}

/** Réglages de la facturation : délai de règlement (billing) ; les seuils d'impayés vivent au Nettoyage. */
export function BillingSettingsScreen() {
  const access = useBillingAccess();
  const resource = useResource(useCallback(() => getBillingSettings(), []));
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel title={t.termTitle} id="reglages-delai">
        <ResourceView resource={resource} lines={3} labels={common} describe={apiErrorText}>
          {(settings) => <TermForm settings={settings} onSaved={resource.set} />}
        </ResourceView>
      </Panel>
      <Panel title={t.thresholdsTitle} id="reglages-seuils">
        <p className="text-ink">{t.thresholds}</p>
        {access?.cleaningSettings ? (
          <Link
            href="/nettoyage/catalogue"
            className="text-accent-ink justify-self-start font-semibold underline"
          >
            {t.thresholdsLink}
          </Link>
        ) : (
          <p className="text-small text-ink-muted">{t.thresholdsNoAccess}</p>
        )}
      </Panel>
    </div>
  );
}
