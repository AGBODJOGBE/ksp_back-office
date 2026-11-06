'use client';

import { type FormEvent, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FormMessage, TextField } from '@/components/ui/field';
import { SelectField } from '@/components/ui/select-field';
import { ApiError } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { savePlaceType } from '@/features/cleaning/api';
import { catalogScreenTexts } from '@/features/cleaning/catalog-screen-texts';
import { errorText } from '@/features/cleaning/errors';
import type { PlaceType, ServiceDefinition } from '@/features/cleaning/schemas';
import { codeFromLabel, move } from '@/features/cleaning/service-draft';
import { nameOr } from '@/features/cleaning/texts';
import { CheckField, ItemTools } from './catalog-parts';
import { Note } from './parts';

const t = catalogScreenTexts.places;
const f = t.form;

const iconLabel = (icon: string) => t.icons[icon] ?? icon;

/** Formulaire d'un type de lieu : nom, description, icône, ordre, état et prestations proposées (ordonnées). */
function PlaceTypeForm({
  place,
  services,
  takenCodes,
  nextOrder,
  onCancel,
  onSaved,
}: {
  place: PlaceType | null;
  services: ServiceDefinition[];
  takenCodes: ReadonlySet<string>;
  nextOrder: number;
  onCancel: () => void;
  onSaved: (place: PlaceType) => void;
}) {
  const known = new Set(services.map((service) => service.code));
  const dropped = (place?.serviceCodes ?? []).filter((code) => !known.has(code));
  const [label, setLabel] = useState(place?.label ?? '');
  const [description, setDescription] = useState(place?.description ?? '');
  const [icon, setIcon] = useState(place?.icon ?? 'house');
  const [order, setOrder] = useState(String(place?.displayOrder ?? nextOrder));
  const [active, setActive] = useState(place?.active ?? true);
  const [selected, setSelected] = useState<string[]>(() =>
    (place?.serviceCodes ?? []).filter((code) => known.has(code)),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const nameOf = (code: string) => services.find((service) => service.code === code)?.name ?? code;
  const icons = Object.keys(t.icons).includes(icon) ? Object.keys(t.icons) : [icon, ...Object.keys(t.icons)];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const found: Record<string, string> = {};
    const name = label.trim();
    if (!name) found.label = catalogScreenTexts.editor.messages.required;
    const displayOrder = /^\d+$/.test(order.trim()) ? Number(order.trim()) : Number.NaN;
    if (Number.isNaN(displayOrder) || displayOrder > 10_000) found.displayOrder = f.invalidOrder;
    setErrors(found);
    setMessage(null);
    if (Object.keys(found).length) return setMessage(catalogScreenTexts.editor.fixErrors);
    setPending(true);
    try {
      const code = place?.code ?? codeFromLabel(name, takenCodes);
      onSaved(
        await savePlaceType(code, {
          label: name,
          ...(description.trim() ? { description: description.trim() } : {}),
          icon,
          displayOrder,
          active,
          serviceCodes: selected,
        }),
      );
    } catch (error) {
      const field = error instanceof ApiError ? error.details.field : undefined;
      if (typeof field === 'string' && ['label', 'description', 'icon', 'displayOrder'].includes(field)) {
        setErrors({ [field]: errorText(error) });
      }
      setMessage(errorText(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      noValidate
      onSubmit={submit}
      aria-labelledby="lieu-titre"
      className="bg-surface-muted rounded-card grid gap-4 p-3 sm:p-5"
    >
      <h3 id="lieu-titre" className="text-ink text-lg font-semibold">
        {place ? f.titleEdit(place.label) : f.titleNew}
      </h3>
      {dropped.length ? <FormMessage tone="info">{f.droppedUnknown(dropped.join(', '))}</FormMessage> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="lieu-libelle"
          label={f.label}
          value={label}
          maxLength={100}
          error={errors.label}
          onChange={(event) => setLabel(event.target.value)}
        />
        <SelectField
          id="lieu-icone"
          label={f.icon}
          hint={f.iconHint}
          value={icon}
          onChange={(event) => setIcon(event.target.value)}
        >
          {icons.map((name) => (
            <option key={name} value={name}>
              {iconLabel(name)}
            </option>
          ))}
        </SelectField>
        <TextField
          id="lieu-description"
          label={f.description}
          hint={f.descriptionHint}
          value={description}
          maxLength={500}
          error={errors.description}
          onChange={(event) => setDescription(event.target.value)}
        />
        <TextField
          id="lieu-ordre"
          label={f.order}
          hint={f.orderHint}
          inputMode="numeric"
          value={order}
          error={errors.displayOrder}
          onChange={(event) => setOrder(event.target.value)}
        />
      </div>
      <CheckField id="lieu-actif" label={f.active} checked={active} onChange={setActive} />

      <fieldset className="rounded-card border-line grid gap-3 border p-3 sm:p-4">
        <legend className="text-ink px-1 font-semibold">{f.services}</legend>
        <p className="text-small text-ink-muted">{f.servicesHint}</p>
        <div className="grid gap-1 sm:grid-cols-2">
          {services.map((service) => (
            <CheckField
              key={service.code}
              id={`lieu-prestation-${service.code}`}
              label={
                <span>
                  {service.name}
                  {!service.active ? (
                    <span className="text-ink-muted font-normal"> ({f.inactiveTag})</span>
                  ) : null}
                </span>
              }
              checked={selected.includes(service.code)}
              onChange={(checked) =>
                setSelected((previous) =>
                  checked ? [...previous, service.code] : previous.filter((code) => code !== service.code),
                )
              }
            />
          ))}
        </div>
        <p className="text-ink font-semibold">{f.selected}</p>
        {selected.length ? (
          <ol className="grid gap-1">
            {selected.map((code, index) => (
              <li key={code} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {index + 1}. {nameOf(code)}
                </span>
                <ItemTools
                  index={index}
                  count={selected.length}
                  name={nameOf(code)}
                  labels={{
                    moveUp: f.moveUp,
                    moveDown: f.moveDown,
                    remove: catalogScreenTexts.editor.remove,
                  }}
                  onMove={(step) => setSelected(move(selected, index, step))}
                />
              </li>
            ))}
          </ol>
        ) : (
          <Note>{f.noneSelected}</Note>
        )}
      </fieldset>

      <FormMessage>{message}</FormMessage>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" variant="action" aria-busy={pending || undefined} disabled={pending}>
          {pending ? catalogScreenTexts.saving : f.confirm}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          {catalogScreenTexts.cancel}
        </Button>
      </div>
    </form>
  );
}

function PlaceCard({
  place,
  services,
  onEdit,
}: {
  place: PlaceType;
  services: ServiceDefinition[];
  onEdit: () => void;
}) {
  const nameOf = (code: string) => services.find((service) => service.code === code)?.name ?? code;
  return (
    <li className="rounded-card border-line bg-surface grid content-start gap-3 border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-ink font-semibold">{place.label}</p>
          <p className="text-small text-ink-muted">
            {iconLabel(place.icon)} · {t.order(place.displayOrder)}
          </p>
        </div>
        <span className="flex flex-wrap gap-1">
          <Badge tone={place.active ? 'success' : 'neutral'}>{place.active ? t.active : t.inactive}</Badge>
          {!place.publiclyVisible ? <Badge tone="warning">{t.hidden}</Badge> : null}
        </span>
      </div>
      {!place.publiclyVisible && place.visibilityReason ? (
        <p className="text-small text-warning">
          {t.hidden} : {t.reasons[place.visibilityReason] ?? place.visibilityReason}
        </p>
      ) : null}
      {place.description ? <p className="text-small text-ink-muted">{place.description}</p> : null}
      <div className="grid gap-1">
        <p className="text-small text-ink font-semibold">{t.services(place.serviceCodes.length)}</p>
        {place.serviceCodes.length ? (
          <p className="text-small text-ink-muted">{place.serviceCodes.map(nameOf).join(' · ')}</p>
        ) : null}
      </div>
      {place.unknownServiceCodes.length || place.inactiveServiceCodes.length ? (
        <ul className="text-small text-warning grid list-disc gap-1 pl-5">
          {place.unknownServiceCodes.map((code) => (
            <li key={`u-${code}`}>{t.unknown(code)}</li>
          ))}
          {place.inactiveServiceCodes.map((code) => (
            <li key={`i-${code}`}>{t.inactiveService(nameOf(code))}</li>
          ))}
        </ul>
      ) : null}
      {place.updatedAt ? (
        <p className="text-small text-ink-subtle">
          {t.updated(
            formatDateTime(place.updatedAt),
            nameOr(place.updatedByName, catalogScreenTexts.someone),
          )}
        </p>
      ) : null}
      <Button variant="secondary" className="justify-self-start" onClick={onEdit}>
        {catalogScreenTexts.edit}
      </Button>
    </li>
  );
}

/** Types de lieu (ADR-034) : liste avec les alertes de cohérence du backend, création et modification. */
export function PlaceTypesPanel({
  places,
  services,
  onChange,
}: {
  places: PlaceType[];
  services: ServiceDefinition[];
  onChange: (places: PlaceType[]) => void;
}) {
  // `null` : nouveau type ; un type : sa modification ; `undefined` : formulaire fermé.
  const [editing, setEditing] = useState<PlaceType | null | undefined>(undefined);
  const [notice, setNotice] = useState<string | null>(null);
  const sorted = [...places].sort(
    (a, b) => a.displayOrder - b.displayOrder || a.label.localeCompare(b.label),
  );
  const nextOrder = (sorted.at(-1)?.displayOrder ?? 0) + 10;
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-small text-ink-muted max-w-reading">{t.lead}</p>
        {editing === undefined ? (
          <Button
            variant="secondary"
            onClick={() => {
              setNotice(null);
              setEditing(null);
            }}
          >
            {t.add}
          </Button>
        ) : null}
      </div>
      <FormMessage tone="success">{notice}</FormMessage>
      {editing !== undefined ? (
        <PlaceTypeForm
          key={editing?.code ?? 'nouveau'}
          place={editing}
          services={services}
          takenCodes={new Set(places.map((place) => place.code))}
          nextOrder={Math.min(nextOrder, 10_000)}
          onCancel={() => setEditing(undefined)}
          onSaved={(saved) => {
            setEditing(undefined);
            setNotice(f.saved(saved.label));
            onChange([...places.filter((place) => place.code !== saved.code), saved]);
          }}
        />
      ) : null}
      {sorted.length ? (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sorted.map((place) => (
            <PlaceCard
              key={place.code}
              place={place}
              services={services}
              onEdit={() => {
                setNotice(null);
                setEditing(place);
              }}
            />
          ))}
        </ul>
      ) : (
        <Note>{t.empty}</Note>
      )}
    </div>
  );
}
