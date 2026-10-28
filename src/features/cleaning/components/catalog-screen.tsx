'use client';

import dynamic from 'next/dynamic';
import { type FormEvent, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FormMessage, TextField } from '@/components/ui/field';
import { formatDateTime, formatXof } from '@/lib/format';
import { useResource } from '@/lib/use-resource';
import { getCatalog, type SettingsInput, updateSettings } from '@/features/cleaning/api';
import { catalogTexts as t } from '@/features/cleaning/catalog-texts';
import { errorText } from '@/features/cleaning/errors';
import type { Catalog, ServiceDefinition, Settings } from '@/features/cleaning/schemas';
import { cleaningTexts, unitName } from '@/features/cleaning/texts';
import { LoadingBlock, Note, Panel, ResourceView, useCleaningAccess } from './parts';

const common = cleaningTexts.common;

const ServiceForm = dynamic(() => import('./service-form').then((module_) => module_.ServiceForm), {
  loading: () => <LoadingBlock lines={4} />,
});

const SETTINGS: Array<{ key: keyof SettingsInput; hint?: string }> = [
  { key: 'depositPercent' },
  { key: 'quoteValidityDays' },
  { key: 'minimumLeadHours' },
  { key: 'freeCancellationHours' },
  { key: 'maxOpenRequests' },
  { key: 'visitThresholdSquareMeters', hint: t.settings.visitThresholdHint },
  { key: 'businessWarningUnpaidInvoices' },
  { key: 'businessSuspensionUnpaidInvoices' },
  { key: 'individualSuspensionUnpaidInterventions' },
  { key: 'individualPaymentGraceHours' },
];

function ServiceCard({ service, onEdit }: { service: ServiceDefinition; onEdit: () => void }) {
  const { pricing } = service;
  const unit = unitName(service.unit);
  return (
    <li className="rounded-card border-line bg-surface grid gap-3 border p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-ink font-semibold">{service.name}</p>
          <p className="text-small text-ink-muted">
            <code>{service.code}</code>
          </p>
        </div>
        <Badge tone={service.active ? 'success' : 'neutral'}>{service.active ? t.active : t.inactive}</Badge>
      </div>
      {service.description ? <p className="text-small text-ink-muted">{service.description}</p> : null}
      <ul className="text-small text-ink grid gap-1">
        <li className="font-semibold tabular-nums">
          {pricing.unitPrice ? t.perUnit(formatXof(pricing.unitPrice), unit) : t.notPriced}
        </li>
        {pricing.minimumPrice ? (
          <li className="tabular-nums">{t.minimum(formatXof(pricing.minimumPrice))}</li>
        ) : null}
        <li>
          {t.team(
            pricing.teamSize.unitsPerAgent,
            unit,
            pricing.teamSize.minAgents,
            pricing.teamSize.maxAgents,
          )}
        </li>
        <li>
          {pricing.options.length} option(s) · {t.coefficients(pricing.communeCoefficients.length)} ·{' '}
          {t.checklist(pricing.checklist.length)}
        </li>
      </ul>
      <p className="text-small text-ink-subtle">
        {pricing.updatedAt
          ? t.version(pricing.version, formatDateTime(pricing.updatedAt), pricing.updatedBy ?? '—')
          : t.versionNever}
      </p>
      <Button variant="secondary" className="justify-self-start" onClick={onEdit}>
        {t.edit}
      </Button>
    </li>
  );
}

function SettingsForm({ settings, onSaved }: { settings: Settings; onSaved: (settings: Settings) => void }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    const values = SETTINGS.map(({ key }) => [key, String(data.get(key) ?? '').trim()] as const);
    if (values.some(([, value]) => !/^\d+$/.test(value))) {
      return setMessage({ error: true, text: common.invalidNumber });
    }
    setPending(true);
    setMessage(null);
    try {
      onSaved(
        await updateSettings(Object.fromEntries(values.map(([k, v]) => [k, Number(v)])) as SettingsInput),
      );
      setMessage({ error: false, text: common.saved });
    } catch (caught) {
      setMessage({ error: true, text: errorText(caught) });
    } finally {
      setPending(false);
    }
  }

  return (
    <form noValidate onSubmit={submit} className="grid gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        {SETTINGS.map(({ key, hint }) => (
          <TextField
            key={key}
            id={`reglage-${key}`}
            name={key}
            label={t.settings[key]}
            hint={hint}
            inputMode="numeric"
            defaultValue={String(settings[key])}
          />
        ))}
      </div>
      <FormMessage tone={message?.error ? 'error' : 'info'}>{message?.text}</FormMessage>
      <Button
        type="submit"
        className="justify-self-start"
        aria-busy={pending || undefined}
        disabled={pending}
      >
        {pending ? common.saving : t.settings.confirm}
      </Button>
    </form>
  );
}

function CatalogView({ catalog, onChange }: { catalog: Catalog; onChange: (catalog: Catalog) => void }) {
  // `null` : nouvelle prestation ; une prestation : sa modification ; `undefined` : formulaire fermé.
  const [editing, setEditing] = useState<ServiceDefinition | null | undefined>(undefined);
  const { settings } = catalog;
  return (
    <div className="grid gap-6">
      <Panel
        title={t.services}
        id="catalogue-prestations"
        action={
          editing === undefined ? (
            <Button variant="secondary" onClick={() => setEditing(null)}>
              {t.add}
            </Button>
          ) : null
        }
      >
        {editing !== undefined ? (
          <ServiceForm
            key={editing?.code ?? 'nouvelle'}
            service={editing}
            onCancel={() => setEditing(undefined)}
            onSaved={(saved) => {
              setEditing(undefined);
              const others = catalog.services.filter((service) => service.code !== saved.code);
              onChange({
                ...catalog,
                services: [...others, saved].sort((a, b) => a.name.localeCompare(b.name)),
              });
            }}
          />
        ) : null}
        {catalog.services.length ? (
          <ul className="grid gap-4 md:grid-cols-2">
            {catalog.services.map((service) => (
              <ServiceCard key={service.code} service={service} onEdit={() => setEditing(service)} />
            ))}
          </ul>
        ) : (
          <Note>{t.empty}</Note>
        )}
      </Panel>

      <Panel title={t.settings.title} id="catalogue-reglages">
        <p className="text-small text-ink-muted">
          {t.settings.lead}{' '}
          {settings.updatedAt
            ? t.settings.updated(formatDateTime(settings.updatedAt), settings.updatedBy ?? '—')
            : null}
        </p>
        <SettingsForm settings={settings} onSaved={(next) => onChange({ ...catalog, settings: next })} />
      </Panel>
    </div>
  );
}

/** Catalogue, grille tarifaire et réglages du Nettoyage (UC-CL-11), réservés à l'admin. */
export function CatalogScreen() {
  const access = useCleaningAccess();
  const catalog = useResource(getCatalog);
  if (access && !access.administer) return <Note>{t.adminOnly}</Note>;
  return (
    <ResourceView resource={catalog} lines={5}>
      {(data) => <CatalogView catalog={data} onChange={catalog.set} />}
    </ResourceView>
  );
}
