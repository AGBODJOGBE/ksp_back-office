'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { type FormEvent, useCallback, useState } from 'react';
import { ButtonLink } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import type { TableColumn } from '@/components/ui/responsive-table';
import { SelectField, TextAreaField } from '@/components/ui/select-field';
import { useResource } from '@/lib/use-resource';
import {
  allCleaningTypes,
  allOffers,
  allParameters,
  allPlaceCategories,
  createPlaceType,
  getPlaceType,
  listPlaceTypes,
  updatePlaceType,
} from '@/features/cleaning/api';
import { catalogTexts } from '@/features/cleaning/catalog-texts';
import { CODE_PATTERN, codeFromLabel, optionalText, parseInteger } from '@/features/cleaning/inputs';
import { cleaningPaths } from '@/features/cleaning/paths';
import type { Parameter, PlaceCategory, PlaceType } from '@/features/cleaning/schemas';
import { cleaningTexts } from '@/features/cleaning/texts';
import {
  CatalogList,
  changedFields,
  CreatedNotice,
  DetailHeader,
  RowLink,
  useOpenCreated,
} from './catalog-parts';
import { ActivationControl, CheckField, OrderedPicker } from './editors';
import {
  ActiveBadge,
  type FieldErrors,
  FormFooter,
  Note,
  Panel,
  ResourceView,
  useCleaningAccess,
  useFormSubmit,
  useIdempotencyKey,
  VisibilityBadge,
} from './parts';

const t = catalogTexts.places;
const d = catalogTexts.detail;
const o = catalogTexts.offers;
const c = cleaningTexts.common;
const paths = cleaningPaths.catalog;

/** Choix du formulaire d'un lieu : catégories et paramètres du catalogue. */
async function loadChoices() {
  const [categories, parameters] = await Promise.all([allPlaceCategories(), allParameters()]);
  return { categories, parameters };
}
type Choices = Awaited<ReturnType<typeof loadChoices>>;

function columnsFor(categories: Map<string, string>): TableColumn<PlaceType>[] {
  return [
    {
      key: 'name',
      header: t.columns.name,
      primary: true,
      cell: (row) => <RowLink href={paths.place(row.id)}>{row.name}</RowLink>,
    },
    { key: 'category', header: t.columns.category, cell: (row) => categories.get(row.categoryId) ?? '—' },
    {
      key: 'parameters',
      header: t.columns.parameters,
      cell: (row) => t.parametersCount(row.parameters.length),
    },
    {
      key: 'visibility',
      header: t.columns.visibility,
      cell: (row) => <VisibilityBadge visible={row.publiclyVisible} reasons={row.visibilityReasons} />,
    },
    { key: 'state', header: t.columns.state, cell: (row) => <ActiveBadge active={row.active} /> },
  ];
}

/** Lieux (`GET /admin/cleaning/place-types`), filtre de catégorie dans l'adresse (`?categorie=`). */
export function PlacesList() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const categoryId = params.get('categorie') ?? undefined;
  const categories = useResource(allPlaceCategories);
  const load = useCallback((cursor?: string) => listPlaceTypes(categoryId)(cursor), [categoryId]);
  const names = new Map(
    categories.state.status === 'ready' ? categories.state.data.map((item) => [item.id, item.name]) : [],
  );
  const options = categories.state.status === 'ready' ? categories.state.data : [];
  return (
    <CatalogList
      key={categoryId ?? 'toutes'}
      load={load}
      columns={columnsFor(names)}
      caption={t.caption}
      empty={t.empty}
      rowKey={(row) => row.id}
      createHref={paths.newPlace(categoryId)}
      createLabel={t.newTitle}
      toolbar={
        <SelectField
          id="lieux-categorie"
          label={t.filter}
          value={categoryId ?? ''}
          onChange={(event) => {
            const next = new URLSearchParams(params.toString());
            if (event.target.value) next.set('categorie', event.target.value);
            else next.delete('categorie');
            const query = next.toString();
            router.replace(query ? `${pathname}?${query}` : pathname);
          }}
          className="w-full sm:w-72"
        >
          <option value="">{t.allCategories}</option>
          {options.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </SelectField>
      }
    />
  );
}

interface Draft {
  code: string;
  codeEdited: boolean;
  name: string;
  categoryId: string;
  description: string;
  icon: string;
  order: string;
  freeDescription: boolean;
  parameterIds: string[];
  areaParameterId: string;
}

const FIELDS = [
  'code',
  'name',
  'categoryId',
  'description',
  'icon',
  'order',
  'freeDescription',
  'parameterIds',
  'areaParameterId',
];

function draftOf(place?: PlaceType, categoryId = ''): Draft {
  return {
    code: place?.code ?? '',
    codeEdited: !!place,
    name: place?.name ?? '',
    categoryId: place?.categoryId ?? categoryId,
    description: place?.description ?? '',
    icon: place?.icon ?? '',
    order: place ? String(place.order) : '',
    freeDescription: place?.freeDescription ?? false,
    parameterIds: place
      ? [...place.parameters].sort((a, b) => a.order - b.order).map((item) => item.parameterId)
      : [],
    areaParameterId: place?.areaParameterId ?? '',
  };
}

function validate(draft: Draft, current?: PlaceType): FieldErrors {
  const errors: FieldErrors = {};
  if (!current && !CODE_PATTERN.test(draft.code)) errors.code = c.invalidCode;
  if (!draft.name.trim()) errors.name = c.required;
  else if (draft.name.trim().length > 100) errors.name = c.tooLong(100);
  if (!draft.categoryId) errors.categoryId = c.required;
  if (draft.description.trim().length > 1000) errors.description = c.tooLong(1000);
  if (draft.icon.trim().length > 50) errors.icon = c.tooLong(50);
  if (draft.order.trim() && parseInteger(draft.order) === null) errors.order = c.invalidInteger;
  else if (current && !draft.order.trim()) errors.order = c.required;
  if (!draft.freeDescription && !draft.areaParameterId) errors.areaParameterId = c.required;
  return errors;
}

function PlaceForm({
  current,
  choices,
  initialCategory,
  readOnly,
  onSaved,
}: {
  current?: PlaceType;
  choices: Choices;
  initialCategory?: string;
  readOnly: boolean;
  onSaved: (place: PlaceType) => void;
}) {
  const [draft, setDraft] = useState<Draft>(draftOf(current, initialCategory));
  const form = useFormSubmit(FIELDS);
  const idempotency = useIdempotencyKey();
  const change = (patch: Partial<Draft>) => setDraft((previous) => ({ ...previous, ...patch }));
  const byId = new Map(choices.parameters.map((parameter) => [parameter.id, parameter]));
  const numbers = draft.parameterIds
    .map((parameterId) => byId.get(parameterId))
    .filter((parameter): parameter is Parameter => parameter?.kind === 'number');

  function setParameters(parameterIds: string[]) {
    change({
      parameterIds,
      areaParameterId: parameterIds.includes(draft.areaParameterId) ? draft.areaParameterId : '',
    });
  }

  function submit(event: FormEvent) {
    void form.submit(event, validate(draft, current), async () => {
      const order = parseInteger(draft.order);
      const fields = {
        categoryId: draft.categoryId,
        name: draft.name.trim(),
        description: draft.description.trim(),
        icon: draft.icon.trim(),
        order: order ?? undefined,
        freeDescription: draft.freeDescription,
        parameterIds: draft.parameterIds,
        areaParameterId: draft.areaParameterId || undefined,
      };
      try {
        if (current) {
          // Textes vidés : chaîne vide envoyée (le contrat n'accepte pas `null`, à valider).
          const body = changedFields(fields, {
            ...current,
            description: current.description ?? '',
            icon: current.icon ?? '',
            parameterIds: [...current.parameters]
              .sort((a, b) => a.order - b.order)
              .map((item) => item.parameterId),
          });
          const saved = Object.keys(body).length ? await updatePlaceType(current.id, body) : current;
          setDraft(draftOf(saved));
          onSaved(saved);
          return c.saved;
        }
        const saved = await createPlaceType(
          {
            ...fields,
            code: draft.code,
            description: optionalText(draft.description),
            icon: optionalText(draft.icon),
          },
          idempotency.key(),
        );
        idempotency.settle();
        onSaved(saved);
      } catch (error) {
        idempotency.settle(error);
        throw error;
      }
    });
  }

  const parameterOptions = choices.parameters.map((parameter) => ({
    id: parameter.id,
    label: parameter.label,
    detail: [
      catalogTexts.parameters.kinds[parameter.kind],
      parameter.unit,
      parameter.active ? null : c.inactive,
    ]
      .filter(Boolean)
      .join(' · '),
    disabled: !parameter.active,
  }));

  return (
    <form noValidate onSubmit={submit} className="grid gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="lieu-nom"
          label={t.name}
          value={draft.name}
          maxLength={100}
          readOnly={readOnly}
          error={form.errors.name}
          onChange={(event) =>
            change({
              name: event.target.value,
              ...(draft.codeEdited ? {} : { code: codeFromLabel(event.target.value) }),
            })
          }
        />
        <SelectField
          id="lieu-categorie"
          label={t.category}
          value={draft.categoryId}
          disabled={readOnly}
          error={form.errors.categoryId}
          onChange={(event) => change({ categoryId: event.target.value })}
        >
          <option value="">{t.chooseCategory}</option>
          {choices.categories.map((category: PlaceCategory) => (
            <option key={category.id} value={category.id}>
              {category.name}
              {category.active ? '' : ` (${c.inactiveFeminine.toLowerCase()})`}
            </option>
          ))}
        </SelectField>
      </div>
      {current ? null : (
        <TextField
          id="lieu-code"
          label={c.code}
          hint={c.codeHint}
          value={draft.code}
          maxLength={50}
          spellCheck={false}
          autoComplete="off"
          error={form.errors.code}
          onChange={(event) => change({ code: event.target.value, codeEdited: true })}
        />
      )}
      <TextAreaField
        id="lieu-description"
        label={t.description}
        hint={t.descriptionHint}
        value={draft.description}
        maxLength={1000}
        readOnly={readOnly}
        error={form.errors.description}
        onChange={(event) => change({ description: event.target.value })}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="lieu-ordre"
          label={c.order}
          hint={c.orderHint}
          inputMode="numeric"
          value={draft.order}
          readOnly={readOnly}
          error={form.errors.order}
          onChange={(event) => change({ order: event.target.value })}
        />
        <TextField
          id="lieu-icone"
          label={t.icon}
          hint={t.iconHint}
          value={draft.icon}
          maxLength={50}
          readOnly={readOnly}
          error={form.errors.icon}
          onChange={(event) => change({ icon: event.target.value })}
        />
      </div>
      <CheckField
        id="lieu-autre"
        label={t.free}
        hint={t.freeHint}
        checked={draft.freeDescription}
        disabled={readOnly}
        onChange={(freeDescription) => change({ freeDescription })}
      />
      <OrderedPicker
        id="lieu-parametres"
        legend={t.parameters}
        hint={t.parametersHint}
        options={parameterOptions}
        value={draft.parameterIds}
        onChange={readOnly ? () => undefined : setParameters}
        error={form.errors.parameterIds}
        empty={t.noParameters}
      />
      <SelectField
        id="lieu-superficie"
        label={t.area}
        hint={numbers.length ? t.areaHint : t.noNumber}
        value={draft.areaParameterId}
        disabled={readOnly || !numbers.length}
        error={form.errors.areaParameterId}
        onChange={(event) => change({ areaParameterId: event.target.value })}
        className="max-w-md"
      >
        <option value="">{t.chooseArea}</option>
        {numbers.map((parameter) => (
          <option key={parameter.id} value={parameter.id}>
            {parameter.label}
            {parameter.unit ? ` (${parameter.unit})` : ''}
          </option>
        ))}
      </SelectField>
      <Note>{t.photo}</Note>
      {readOnly ? null : (
        <FormFooter
          pending={form.pending}
          message={form.message}
          success={form.success}
          label={current ? c.save : t.newTitle}
        />
      )}
    </form>
  );
}

/** Création d'un lieu (`POST /admin/cleaning/place-types`), catégorie préremplie par `?categorie=`. */
export function NewPlace() {
  const params = useSearchParams();
  const openCreated = useOpenCreated();
  const choices = useResource(loadChoices);
  return (
    <div className="grid gap-6">
      <DetailHeader backHref={paths.places} title={t.newTitle} />
      <Panel title={d.summary} id="lieu-formulaire">
        <ResourceView resource={choices} lines={6}>
          {(data) => (
            <PlaceForm
              choices={data}
              initialCategory={params.get('categorie') ?? undefined}
              readOnly={false}
              onSaved={(place) => openCreated(paths.place(place.id))}
            />
          )}
        </ResourceView>
      </Panel>
    </div>
  );
}

function PlaceOffers({ placeId, canManage }: { placeId: string; canManage: boolean }) {
  const offers = useResource(
    useCallback(async () => {
      const [items, types] = await Promise.all([allOffers({ placeTypeId: placeId }), allCleaningTypes()]);
      return { items, types: new Map(types.map((type) => [type.id, type.name])) };
    }, [placeId]),
  );
  return (
    <Panel
      title={t.offers}
      id="lieu-offres"
      action={
        canManage ? (
          <ButtonLink href={paths.newOffer(placeId)} variant="secondary">
            {t.addOffer}
          </ButtonLink>
        ) : undefined
      }
    >
      <ResourceView resource={offers} lines={2}>
        {({ items, types }) =>
          items.length ? (
            <ul className="grid gap-2">
              {items.map((offer) => (
                <li key={offer.id} className="flex flex-wrap items-center gap-2">
                  <RowLink href={paths.offer(offer.id)}>
                    {types.get(offer.cleaningTypeId) ?? o.unknownType}
                  </RowLink>
                  <ActiveBadge active={offer.active} feminine />
                  <span className="text-small text-ink-muted">
                    {offer.currentTariffVersion === null ? o.onQuote : o.version(offer.currentTariffVersion)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Note>{t.noOffer}</Note>
          )
        }
      </ResourceView>
      <ButtonLink href={paths.simulate(placeId, [], [])} variant="ghost" className="justify-self-start">
        {t.simulate}
      </ButtonLink>
    </Panel>
  );
}

/** Fiche d'un lieu : modification, activation, visibilité sur le portail et offres. */
export function PlaceDetail({ id }: { id: string }) {
  const access = useCleaningAccess();
  const resource = useResource(
    useCallback(async () => {
      const [place, choices] = await Promise.all([getPlaceType(id), loadChoices()]);
      return { place, choices };
    }, [id]),
  );
  const canManage = !!access?.['cleaning.catalog.manage'];
  return (
    <ResourceView resource={resource} lines={8}>
      {({ place, choices }) => {
        const setPlace = (saved: PlaceType) => resource.set({ place: saved, choices });
        return (
          <div className="grid gap-6">
            <DetailHeader
              backHref={paths.places}
              title={place.name}
              badges={
                <>
                  <ActiveBadge active={place.active} />
                  <VisibilityBadge visible={place.publiclyVisible} reasons={place.visibilityReasons} />
                </>
              }
              updatedAt={place.updatedAt}
              updatedByName={place.updatedByName}
            />
            <CreatedNotice />
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <Panel title={d.edit} id="lieu-formulaire">
                <p className="text-small text-ink-muted">
                  {c.code} : <code>{place.code}</code>
                </p>
                {canManage ? null : <p className="text-small text-ink-muted">{c.readOnly}</p>}
                <PlaceForm
                  key={place.id}
                  current={place}
                  choices={choices}
                  readOnly={!canManage}
                  onSaved={setPlace}
                />
              </Panel>
              <div className="grid gap-6">
                <Panel title={d.activation} id="lieu-activation">
                  <ActivationControl
                    name={place.name}
                    active={place.active}
                    canManage={canManage}
                    hint={d.activateHint}
                    onChange={async (active) => setPlace(await updatePlaceType(id, { active }))}
                  />
                </Panel>
                <PlaceOffers placeId={place.id} canManage={canManage} />
              </div>
            </div>
          </div>
        );
      }}
    </ResourceView>
  );
}
