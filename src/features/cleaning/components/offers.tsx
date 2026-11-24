'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { type FormEvent, useCallback, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import type { TableColumn } from '@/components/ui/responsive-table';
import { SelectField } from '@/components/ui/select-field';
import { useResource } from '@/lib/use-resource';
import {
  allCleaningTypes,
  allParameters,
  allPlaceTypes,
  createOffer,
  getOffer,
  listOffers,
  updateOffer,
} from '@/features/cleaning/api';
import { catalogTexts } from '@/features/cleaning/catalog-texts';
import { parseInteger } from '@/features/cleaning/inputs';
import { cleaningPaths } from '@/features/cleaning/paths';
import type { Offer, TeamRuleBracket } from '@/features/cleaning/schemas';
import { cleaningTexts } from '@/features/cleaning/texts';
import {
  CatalogList,
  changedFields,
  CreatedNotice,
  DetailHeader,
  RowLink,
  useOpenCreated,
} from './catalog-parts';
import { ActivationControl, FieldGroup, OrderedPicker, RowFrame } from './editors';
import {
  ActiveBadge,
  type FieldErrors,
  FormFooter,
  Panel,
  ResourceView,
  useCleaningAccess,
  useFormSubmit,
  useIdempotencyKey,
  VisibilityBadge,
} from './parts';
import { TariffsPanel } from './tariffs';

const t = catalogTexts.offers;
const d = catalogTexts.detail;
const c = cleaningTexts.common;
const paths = cleaningPaths.catalog;

/** Lieux, types et paramètres du catalogue : noms des offres et choix du formulaire. */
export async function loadCatalog() {
  const [places, types, parameters] = await Promise.all([
    allPlaceTypes(),
    allCleaningTypes(),
    allParameters(),
  ]);
  return { places, types, parameters };
}
export type Catalog = Awaited<ReturnType<typeof loadCatalog>>;

const nameIn = <T extends { id: string; name: string }>(items: readonly T[], id: string, fallback: string) =>
  items.find((item) => item.id === id)?.name ?? fallback;

export function offerTitle(offer: Offer, catalog: Pick<Catalog, 'places' | 'types'>): string {
  return `${nameIn(catalog.types, offer.cleaningTypeId, t.unknownType)} · ${nameIn(catalog.places, offer.placeTypeId, t.unknownPlace)}`;
}

function TariffState({ offer }: { offer: Offer }) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span>{offer.currentTariffVersion === null ? t.onQuote : t.version(offer.currentTariffVersion)}</span>
      {offer.draftTariffVersion === null ? null : (
        <Badge tone="accent">{t.draft(offer.draftTariffVersion)}</Badge>
      )}
    </span>
  );
}

function columnsFor(catalog: Pick<Catalog, 'places' | 'types'> | null): TableColumn<Offer>[] {
  return [
    {
      key: 'offer',
      header: t.columns.offer,
      primary: true,
      cell: (row) => <RowLink href={paths.offer(row.id)}>{catalog ? offerTitle(row, catalog) : '…'}</RowLink>,
    },
    { key: 'tariff', header: t.columns.tariff, cell: (row) => <TariffState offer={row} /> },
    {
      key: 'visibility',
      header: t.columns.visibility,
      cell: (row) => <VisibilityBadge visible={row.publiclyVisible} reasons={row.visibilityReasons} />,
    },
    { key: 'state', header: t.columns.state, cell: (row) => <ActiveBadge active={row.active} feminine /> },
  ];
}

const loadNames = async () => {
  const [places, types] = await Promise.all([allPlaceTypes(), allCleaningTypes()]);
  return { places, types };
};

/** Offres (`GET /admin/cleaning/offers`), filtres lieu et type dans l'adresse (`?lieu=`, `?type=`). */
export function OffersList() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const placeTypeId = params.get('lieu') ?? undefined;
  const cleaningTypeId = params.get('type') ?? undefined;
  const names = useResource(loadNames);
  const catalog = names.state.status === 'ready' ? names.state.data : null;
  const load = useCallback(
    (cursor?: string) => listOffers({ placeTypeId, cleaningTypeId })(cursor),
    [placeTypeId, cleaningTypeId],
  );
  const setFilter = (name: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(name, value);
    else next.delete(name);
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  };
  return (
    <CatalogList
      key={`${placeTypeId ?? ''}-${cleaningTypeId ?? ''}`}
      load={load}
      columns={columnsFor(catalog)}
      caption={t.caption}
      empty={t.empty}
      rowKey={(row) => row.id}
      createHref={paths.newOffer(placeTypeId)}
      createLabel={t.newTitle}
      toolbar={
        <>
          <SelectField
            id="offres-lieu"
            label={t.place}
            value={placeTypeId ?? ''}
            onChange={(event) => setFilter('lieu', event.target.value)}
            className="w-full sm:w-64"
          >
            <option value="">{t.allPlaces}</option>
            {catalog?.places.map((place) => (
              <option key={place.id} value={place.id}>
                {place.name}
              </option>
            ))}
          </SelectField>
          <SelectField
            id="offres-type"
            label={t.type}
            value={cleaningTypeId ?? ''}
            onChange={(event) => setFilter('type', event.target.value)}
            className="w-full sm:w-64"
          >
            <option value="">{t.allTypes}</option>
            {catalog?.types.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </SelectField>
        </>
      }
    />
  );
}

interface BracketDraft {
  fromArea: string;
  toArea: string;
  agents: string;
  durationMinutes: string;
}

interface Draft {
  placeTypeId: string;
  cleaningTypeId: string;
  extraParameterIds: string[];
  teamRule: BracketDraft[];
  order: string;
}

const FIELDS = ['placeTypeId', 'cleaningTypeId', 'extraParameterIds', 'teamRule', 'order'];

const bracketDraft = (bracket: TeamRuleBracket): BracketDraft => ({
  fromArea: String(bracket.fromArea),
  toArea: bracket.toArea === null ? '' : String(bracket.toArea),
  agents: String(bracket.agents),
  durationMinutes: String(bracket.durationMinutes),
});

function draftOf(offer?: Offer, placeTypeId = ''): Draft {
  return {
    placeTypeId: offer?.placeTypeId ?? placeTypeId,
    cleaningTypeId: offer?.cleaningTypeId ?? '',
    extraParameterIds: offer
      ? [...offer.extraParameters].sort((a, b) => a.order - b.order).map((item) => item.parameterId)
      : [],
    teamRule: offer ? offer.teamRule.map(bracketDraft) : [],
    order: offer ? String(offer.order) : '',
  };
}

function validate(draft: Draft, current?: Offer): FieldErrors {
  const errors: FieldErrors = {};
  if (!current && !draft.placeTypeId) errors.placeTypeId = c.required;
  if (!current && !draft.cleaningTypeId) errors.cleaningTypeId = c.required;
  if (draft.order.trim() && parseInteger(draft.order) === null) errors.order = c.invalidInteger;
  else if (current && !draft.order.trim()) errors.order = c.required;
  draft.teamRule.forEach((bracket, index) => {
    const at = `teamRule[${index}]`;
    if (parseInteger(bracket.fromArea) === null) errors[`${at}.fromArea`] = c.invalidInteger;
    if (bracket.toArea.trim() && parseInteger(bracket.toArea) === null)
      errors[`${at}.toArea`] = c.invalidInteger;
    const agents = parseInteger(bracket.agents);
    if (agents === null || agents < 1 || agents > 50) errors[`${at}.agents`] = c.between(1, 50);
    const minutes = parseInteger(bracket.durationMinutes);
    if (minutes === null || minutes < 15 || minutes > 1440)
      errors[`${at}.durationMinutes`] = c.between(15, 1440);
  });
  return errors;
}

const teamRuleBody = (rows: readonly BracketDraft[]): TeamRuleBracket[] =>
  rows.map((row) => ({
    fromArea: parseInteger(row.fromArea) ?? 0,
    toArea: row.toArea.trim() ? (parseInteger(row.toArea) ?? 0) : null,
    agents: parseInteger(row.agents) ?? 1,
    durationMinutes: parseInteger(row.durationMinutes) ?? 15,
  }));

function TeamRuleEditor({
  rows,
  errors,
  readOnly,
  onChange,
}: {
  rows: BracketDraft[];
  errors: FieldErrors;
  readOnly: boolean;
  onChange: (rows: BracketDraft[]) => void;
}) {
  const update = (index: number, patch: Partial<BracketDraft>) =>
    onChange(rows.map((row, at) => (at === index ? { ...row, ...patch } : row)));
  function add() {
    // Commodité de saisie : la tranche suivante commence juste après la précédente (R-CA-10).
    const previous = rows.at(-1);
    const end = previous ? parseInteger(previous.toArea) : null;
    onChange([
      ...rows,
      {
        fromArea: previous ? (end === null ? '' : String(end + 1)) : '0',
        toArea: '',
        agents: '1',
        durationMinutes: '',
      },
    ]);
  }
  return (
    <FieldGroup id="offre-equipe" legend={t.team} hint={t.teamHint} error={errors.teamRule}>
      {rows.length ? null : <p className="text-small text-ink-muted">{t.noBracket}</p>}
      {rows.map((row, index) => {
        const at = `teamRule[${index}]`;
        const title = t.bracket(index + 1);
        return (
          <RowFrame
            key={index}
            id={`offre-tranche-${index}`}
            title={title}
            error={errors[at]}
            onRemove={readOnly ? undefined : () => onChange(rows.filter((_, position) => position !== index))}
          >
            <div className="grid gap-3 sm:grid-cols-4">
              <TextField
                id={`offre-tranche-${index}-de`}
                label={t.from}
                inputMode="numeric"
                value={row.fromArea}
                readOnly={readOnly}
                error={errors[`${at}.fromArea`]}
                onChange={(event) => update(index, { fromArea: event.target.value })}
              />
              <TextField
                id={`offre-tranche-${index}-a`}
                label={t.to}
                hint={t.toHint}
                inputMode="numeric"
                value={row.toArea}
                readOnly={readOnly}
                error={errors[`${at}.toArea`]}
                onChange={(event) => update(index, { toArea: event.target.value })}
              />
              <TextField
                id={`offre-tranche-${index}-agents`}
                label={t.agents}
                inputMode="numeric"
                value={row.agents}
                readOnly={readOnly}
                error={errors[`${at}.agents`]}
                onChange={(event) => update(index, { agents: event.target.value })}
              />
              <TextField
                id={`offre-tranche-${index}-duree`}
                label={t.minutes}
                inputMode="numeric"
                value={row.durationMinutes}
                readOnly={readOnly}
                error={errors[`${at}.durationMinutes`]}
                onChange={(event) => update(index, { durationMinutes: event.target.value })}
              />
            </div>
          </RowFrame>
        );
      })}
      {readOnly || rows.length >= 20 ? null : (
        <Button variant="secondary" className="justify-self-start" onClick={add}>
          {t.addBracket}
        </Button>
      )}
    </FieldGroup>
  );
}

function OfferForm({
  current,
  catalog,
  initialPlace,
  readOnly,
  onSaved,
}: {
  current?: Offer;
  catalog: Catalog;
  initialPlace?: string;
  readOnly: boolean;
  onSaved: (offer: Offer) => void;
}) {
  const [draft, setDraft] = useState<Draft>(draftOf(current, initialPlace));
  const form = useFormSubmit(FIELDS);
  const idempotency = useIdempotencyKey();
  const change = (patch: Partial<Draft>) => setDraft((previous) => ({ ...previous, ...patch }));
  const place = catalog.places.find((item) => item.id === draft.placeTypeId);
  const placeParameters = new Set(place?.parameters.map((item) => item.parameterId));

  function submit(event: FormEvent) {
    void form.submit(event, validate(draft, current), async () => {
      const order = parseInteger(draft.order);
      const fields = {
        extraParameterIds: draft.extraParameterIds,
        teamRule: teamRuleBody(draft.teamRule),
        order: order ?? undefined,
      };
      try {
        if (current) {
          const body = changedFields(fields, {
            ...current,
            extraParameterIds: [...current.extraParameters]
              .sort((a, b) => a.order - b.order)
              .map((item) => item.parameterId),
          });
          const saved = Object.keys(body).length ? await updateOffer(current.id, body) : current;
          setDraft(draftOf(saved));
          onSaved(saved);
          return c.saved;
        }
        const saved = await createOffer(
          { ...fields, placeTypeId: draft.placeTypeId, cleaningTypeId: draft.cleaningTypeId },
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

  const extraOptions = catalog.parameters
    .filter((parameter) => !placeParameters.has(parameter.id))
    .map((parameter) => ({
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
      {current ? (
        <p className="text-small text-ink-muted">{t.fixed}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            id="offre-lieu"
            label={t.place}
            hint={t.oneByPair}
            value={draft.placeTypeId}
            error={form.errors.placeTypeId}
            onChange={(event) => change({ placeTypeId: event.target.value })}
          >
            <option value="">{t.choosePlace}</option>
            {catalog.places.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
                {item.active ? '' : ` (${c.inactive.toLowerCase()})`}
              </option>
            ))}
          </SelectField>
          <SelectField
            id="offre-type"
            label={t.type}
            value={draft.cleaningTypeId}
            error={form.errors.cleaningTypeId}
            onChange={(event) => change({ cleaningTypeId: event.target.value })}
          >
            <option value="">{t.chooseType}</option>
            {catalog.types.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
                {item.active ? '' : ` (${c.inactive.toLowerCase()})`}
              </option>
            ))}
          </SelectField>
        </div>
      )}
      <OrderedPicker
        id="offre-parametres"
        legend={t.extra}
        hint={t.extraHint}
        options={extraOptions}
        value={draft.extraParameterIds}
        onChange={readOnly ? () => undefined : (extraParameterIds) => change({ extraParameterIds })}
        error={form.errors.extraParameterIds}
        empty={catalogTexts.places.noParameters}
      />
      <TeamRuleEditor
        rows={draft.teamRule}
        errors={form.errors}
        readOnly={readOnly}
        onChange={(teamRule) => change({ teamRule })}
      />
      <TextField
        id="offre-ordre"
        label={c.order}
        hint={c.orderHint}
        inputMode="numeric"
        value={draft.order}
        readOnly={readOnly}
        error={form.errors.order}
        onChange={(event) => change({ order: event.target.value })}
        className="max-w-xs"
      />
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

/** Création d'une offre (`POST /admin/cleaning/offers`), lieu prérempli par `?lieu=`. */
export function NewOffer() {
  const params = useSearchParams();
  const openCreated = useOpenCreated();
  const catalog = useResource(loadCatalog);
  return (
    <div className="grid gap-6">
      <DetailHeader backHref={paths.offers} title={t.newTitle} />
      <Panel title={d.summary} id="offre-formulaire">
        <ResourceView resource={catalog} lines={6}>
          {(data) => (
            <OfferForm
              catalog={data}
              initialPlace={params.get('lieu') ?? undefined}
              readOnly={false}
              onSaved={(offer) => openCreated(paths.offer(offer.id))}
            />
          )}
        </ResourceView>
      </Panel>
    </div>
  );
}

/** Fiche d'une offre : équipe, paramètres propres, activation et tarif (versions, brouillon, publication). */
export function OfferDetail({ id }: { id: string }) {
  const access = useCleaningAccess();
  const resource = useResource(
    useCallback(async () => {
      const [offer, catalog] = await Promise.all([getOffer(id), loadCatalog()]);
      return { offer, catalog };
    }, [id]),
  );
  const canManage = !!access?.['cleaning.catalog.manage'];
  return (
    <ResourceView resource={resource} lines={8}>
      {({ offer, catalog }) => {
        const setOffer = (saved: Offer) => resource.set({ offer: saved, catalog });
        return (
          <div className="grid gap-6">
            <DetailHeader
              backHref={paths.offers}
              title={offerTitle(offer, catalog)}
              badges={
                <>
                  <ActiveBadge active={offer.active} feminine />
                  <VisibilityBadge visible={offer.publiclyVisible} reasons={offer.visibilityReasons} />
                </>
              }
              updatedAt={offer.updatedAt}
              updatedByName={offer.updatedByName}
            />
            <CreatedNotice />
            <TariffsPanel
              offer={offer}
              catalog={catalog}
              canManage={canManage}
              onOfferChanged={() => void getOffer(id).then(setOffer, () => undefined)}
            />
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <Panel title={d.edit} id="offre-formulaire">
                {canManage ? null : <p className="text-small text-ink-muted">{c.readOnly}</p>}
                <OfferForm
                  key={offer.id}
                  current={offer}
                  catalog={catalog}
                  readOnly={!canManage}
                  onSaved={setOffer}
                />
              </Panel>
              <Panel title={d.activation} id="offre-activation">
                <ActivationControl
                  name={offerTitle(offer, catalog)}
                  active={offer.active}
                  feminine
                  canManage={canManage}
                  hint={d.activateHint}
                  onChange={async (active) => setOffer(await updateOffer(id, { active }))}
                />
              </Panel>
            </div>
          </div>
        );
      }}
    </ResourceView>
  );
}
