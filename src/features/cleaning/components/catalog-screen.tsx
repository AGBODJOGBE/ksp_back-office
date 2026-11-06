'use client';

import dynamic from 'next/dynamic';
import { type FormEvent, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FormMessage, TextField } from '@/components/ui/field';
import { formatDateTime, formatXof } from '@/lib/format';
import { useResource } from '@/lib/use-resource';
import {
  getCatalog,
  listPlaceTypes,
  listZones,
  type SettingsInput,
  updateSettings,
} from '@/features/cleaning/api';
import { catalogScreenTexts as t } from '@/features/cleaning/catalog-screen-texts';
import { errorText } from '@/features/cleaning/errors';
import type { Catalog, PlaceType, ServiceDefinition, Settings } from '@/features/cleaning/schemas';
import { cleaningTexts, nameOr } from '@/features/cleaning/texts';
import { LoadingBlock, Note, Panel, ResourceView, useCleaningAccess } from './parts';
import { PlaceTypesPanel } from './place-types-panel';

const common = cleaningTexts.common;

const ServiceEditor = dynamic(() => import('./service-editor').then((module_) => module_.ServiceEditor), {
  loading: () => <LoadingBlock lines={6} />,
});

/** Réglages modifiables ; le seuil de visite (déprécié, sans effet) n'est plus affiché. */
const SETTINGS: Array<keyof SettingsInput> = [
  'depositPercent',
  'quoteValidityDays',
  'minimumLeadHours',
  'freeCancellationHours',
  'maxOpenRequests',
  'businessWarningUnpaidInvoices',
  'businessSuspensionUnpaidInvoices',
  'individualSuspensionUnpaidInterventions',
  'individualPaymentGraceHours',
  'locationRetentionMonths',
];

function ServiceCard({ service, onEdit }: { service: ServiceDefinition; onEdit: () => void }) {
  const { pricing } = service;
  const s = t.services;
  return (
    <li className="rounded-card border-line bg-surface grid content-start gap-3 border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-ink min-w-0 font-semibold">{service.name}</p>
        <Badge tone={service.active ? 'success' : 'neutral'}>{service.active ? t.active : t.inactive}</Badge>
      </div>
      {service.description ? <p className="text-small text-ink-muted">{service.description}</p> : null}
      <ul className="text-small text-ink grid gap-1">
        <li>
          {s.summary(
            service.fields.filter((field) => field.active).length,
            service.options.filter((option) => option.active).length,
            pricing.frequencies.filter((frequency) => frequency.active).length,
          )}
        </li>
        {pricing.minimumPrice ? (
          <li className="tabular-nums">{s.minimum(formatXof(pricing.minimumPrice))}</li>
        ) : null}
      </ul>
      <p className="text-small text-ink-subtle">
        {pricing.updatedAt
          ? s.version(
              pricing.version,
              formatDateTime(pricing.updatedAt),
              nameOr(pricing.updatedByName, t.someone),
            )
          : s.versionNever}
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
  const keys = SETTINGS.filter((key) => settings[key] !== undefined);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    const values = keys.map((key) => [key, String(data.get(key) ?? '').trim()] as const);
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
        {keys.map((key) => (
          <TextField
            key={key}
            id={`reglage-${key}`}
            name={key}
            label={t.settings[key]}
            inputMode="numeric"
            defaultValue={String(settings[key])}
          />
        ))}
      </div>
      <FormMessage tone={message?.error ? 'error' : 'success'}>{message?.text}</FormMessage>
      <Button
        type="submit"
        variant="action"
        className="justify-self-start"
        aria-busy={pending || undefined}
        disabled={pending}
      >
        {pending ? common.saving : t.settings.confirm}
      </Button>
    </form>
  );
}

interface CatalogData {
  catalog: Catalog;
  places: PlaceType[] | null;
  communes: string[];
}

async function loadCatalog(): Promise<CatalogData> {
  const [catalog, places, zones] = await Promise.all([
    getCatalog(),
    listPlaceTypes().catch(() => null),
    listZones().catch(() => []),
  ]);
  return {
    catalog,
    places,
    communes: zones.filter((zone) => zone.active).map((zone) => zone.commune),
  };
}

function CatalogView({ data, onChange }: { data: CatalogData; onChange: (data: CatalogData) => void }) {
  // `null` : nouvelle prestation ; une prestation : sa modification ; `undefined` : éditeur fermé.
  const [editing, setEditing] = useState<ServiceDefinition | null | undefined>(undefined);
  const [notice, setNotice] = useState<string | null>(null);
  const { catalog, places, communes } = data;
  const { settings } = catalog;
  const nameOf = (code: string) => catalog.services.find((service) => service.code === code)?.name ?? code;
  const unplaced = catalog.unplacedServiceCodes ?? [];

  if (editing !== undefined) {
    return (
      <Panel title={t.services.title} id="catalogue-prestations">
        <ServiceEditor
          key={editing?.code ?? 'nouvelle'}
          service={editing}
          communes={communes}
          takenCodes={new Set(catalog.services.map((service) => service.code))}
          onCancel={() => setEditing(undefined)}
          onSaved={(saved) => {
            setEditing(undefined);
            const affected = saved.affectedPlaceTypes ?? [];
            setNotice(
              [
                t.editor.saved(saved.pricing.version),
                affected.length ? t.editor.affected(affected.map((place) => place.label).join(', ')) : '',
              ]
                .filter(Boolean)
                .join(' '),
            );
            const others = catalog.services.filter((service) => service.code !== saved.code);
            onChange({
              ...data,
              catalog: {
                ...catalog,
                services: [...others, saved].sort((a, b) => a.name.localeCompare(b.name)),
              },
            });
          }}
        />
      </Panel>
    );
  }

  return (
    <div className="grid gap-6">
      <nav aria-label={t.sections.label} className="flex flex-wrap gap-2">
        {(
          [
            ['catalogue-lieux', t.sections.places],
            ['catalogue-prestations', t.sections.services],
            ['catalogue-reglages', t.sections.settings],
          ] as const
        ).map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            className="rounded-control border-line text-ink hover:bg-surface-muted inline-flex min-h-11 items-center border px-4 font-semibold"
          >
            {label}
          </a>
        ))}
      </nav>

      <Panel title={t.places.title} id="catalogue-lieux">
        {places ? (
          <PlaceTypesPanel
            places={places}
            services={catalog.services}
            onChange={(next) => onChange({ ...data, places: next })}
          />
        ) : (
          <Note>{common.genericError}</Note>
        )}
      </Panel>

      <Panel
        title={t.services.title}
        id="catalogue-prestations"
        action={
          <Button
            variant="secondary"
            onClick={() => {
              setNotice(null);
              setEditing(null);
            }}
          >
            {t.services.add}
          </Button>
        }
      >
        <p className="text-small text-ink-muted max-w-reading">{t.services.lead}</p>
        <FormMessage tone="success">{notice}</FormMessage>
        {unplaced.length ? (
          <FormMessage tone="info">{t.services.unplaced(unplaced.map(nameOf).join(', '))}</FormMessage>
        ) : null}
        {catalog.services.length ? (
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {catalog.services.map((service) => (
              <ServiceCard
                key={service.code}
                service={service}
                onEdit={() => {
                  setNotice(null);
                  setEditing(service);
                }}
              />
            ))}
          </ul>
        ) : (
          <Note>{t.services.empty}</Note>
        )}
      </Panel>

      <Panel title={t.settings.title} id="catalogue-reglages">
        <p className="text-small text-ink-muted">
          {t.settings.lead}{' '}
          {settings.updatedAt
            ? t.settings.updated(
                formatDateTime(settings.updatedAt),
                nameOr(settings.updatedByName, t.someone),
              )
            : null}
        </p>
        <SettingsForm
          settings={settings}
          onSaved={(next) => onChange({ ...data, catalog: { ...catalog, settings: next } })}
        />
      </Panel>
    </div>
  );
}

/**
 * Catalogue du Nettoyage (UC-CL-11, ADR-033 et ADR-034), réservé à l'admin : types de lieu, prestations
 * (questions, options, fréquences, tarifs, essai de prix) et réglages.
 */
export function CatalogScreen() {
  const access = useCleaningAccess();
  const resource = useResource(loadCatalog);
  if (access && !access.administer) return <Note>{t.adminOnly}</Note>;
  return (
    <ResourceView resource={resource} lines={5}>
      {(data) => <CatalogView data={data} onChange={resource.set} />}
    </ResourceView>
  );
}
