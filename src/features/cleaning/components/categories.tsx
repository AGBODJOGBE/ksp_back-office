'use client';

import { type FormEvent, useCallback, useState } from 'react';
import { ButtonLink } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import type { TableColumn } from '@/components/ui/responsive-table';
import { useResource } from '@/lib/use-resource';
import {
  createPlaceCategory,
  getPlaceCategory,
  listPlaceCategories,
  listPlaceTypes,
  updatePlaceCategory,
  xof,
} from '@/features/cleaning/api';
import { catalogTexts } from '@/features/cleaning/catalog-texts';
import { CODE_PATTERN, codeFromLabel, optionalText, parseInteger } from '@/features/cleaning/inputs';
import { cleaningPaths } from '@/features/cleaning/paths';
import type { PlaceCategory, PlaceType } from '@/features/cleaning/schemas';
import { cleaningTexts } from '@/features/cleaning/texts';
import {
  CatalogList,
  changedFields,
  CreatedNotice,
  DetailHeader,
  RowLink,
  useOpenCreated,
} from './catalog-parts';
import { ActivationControl } from './editors';
import {
  ActiveBadge,
  Amount,
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

const t = catalogTexts.categories;
const d = catalogTexts.detail;
const c = cleaningTexts.common;
const paths = cleaningPaths.catalog;

const columns: TableColumn<PlaceCategory>[] = [
  {
    key: 'name',
    header: t.columns.name,
    primary: true,
    cell: (row) => <RowLink href={paths.category(row.id)}>{row.name}</RowLink>,
  },
  { key: 'order', header: t.columns.order, className: 'tabular-nums', cell: (row) => row.order },
  {
    key: 'fee',
    header: t.columns.visitFee,
    cell: (row) => <Amount value={row.visitFee} empty={t.visitFeeDefault} />,
  },
  { key: 'state', header: t.columns.state, cell: (row) => <ActiveBadge active={row.active} feminine /> },
];

/** Catégories de lieu (`GET /admin/cleaning/place-categories`, ordre d'affichage). */
export function CategoriesList() {
  return (
    <CatalogList
      load={listPlaceCategories}
      columns={columns}
      caption={t.caption}
      empty={t.empty}
      rowKey={(row) => row.id}
      createHref={paths.newCategory}
      createLabel={t.newTitle}
    />
  );
}

interface Draft {
  code: string;
  codeEdited: boolean;
  name: string;
  icon: string;
  order: string;
  visitFee: string;
}

const FIELDS = ['code', 'name', 'icon', 'order', 'visitFee'];

function draftOf(category?: PlaceCategory): Draft {
  return {
    code: category?.code ?? '',
    codeEdited: !!category,
    name: category?.name ?? '',
    icon: category?.icon ?? '',
    order: category ? String(category.order) : '',
    visitFee: category?.visitFee ? String(category.visitFee.amount) : '',
  };
}

function validate(draft: Draft, current?: PlaceCategory): FieldErrors {
  const errors: FieldErrors = {};
  if (!current && !CODE_PATTERN.test(draft.code)) errors.code = c.invalidCode;
  if (!draft.name.trim()) errors.name = c.required;
  else if (draft.name.trim().length > 100) errors.name = c.tooLong(100);
  if (draft.icon.trim().length > 50) errors.icon = c.tooLong(50);
  if (draft.order.trim() && parseInteger(draft.order) === null) errors.order = c.invalidInteger;
  else if (current && !draft.order.trim()) errors.order = c.required;
  const fee = draft.visitFee.trim();
  if (fee) {
    const amount = parseInteger(fee);
    if (amount === null || amount > 100_000_000) errors.visitFee = c.invalidAmount;
  } else if (current?.visitFee) errors.visitFee = t.visitFeeLocked;
  return errors;
}

function CategoryForm({
  current,
  readOnly,
  onSaved,
}: {
  current?: PlaceCategory;
  readOnly: boolean;
  onSaved: (category: PlaceCategory) => void;
}) {
  const [draft, setDraft] = useState<Draft>(draftOf(current));
  const form = useFormSubmit(FIELDS);
  const idempotency = useIdempotencyKey();
  const change = (patch: Partial<Draft>) => setDraft((previous) => ({ ...previous, ...patch }));
  // Frais masqués (`cleaning.amounts.read` absent) : le champ n'est ni montré ni envoyé.
  const feeHidden = !!current && current.visitFee === undefined;

  function submit(event: FormEvent) {
    void form.submit(event, validate(draft, current), async () => {
      const order = parseInteger(draft.order);
      const fee = parseInteger(draft.visitFee);
      const fields = {
        name: draft.name.trim(),
        icon: optionalText(draft.icon),
        order: order ?? undefined,
        visitFee: fee === null || feeHidden ? undefined : xof(fee),
      };
      try {
        if (current) {
          // Icône vidée : chaîne vide envoyée (le contrat n'accepte pas `null`, à valider).
          const body = changedFields(
            { ...fields, icon: draft.icon.trim() },
            { ...current, icon: current.icon ?? '' },
          );
          const saved = Object.keys(body).length ? await updatePlaceCategory(current.id, body) : current;
          setDraft(draftOf(saved));
          onSaved(saved);
          return c.saved;
        }
        const saved = await createPlaceCategory({ ...fields, code: draft.code }, idempotency.key());
        idempotency.settle();
        onSaved(saved);
      } catch (error) {
        idempotency.settle(error);
        throw error;
      }
    });
  }

  return (
    <form noValidate onSubmit={submit} className="grid gap-5">
      <TextField
        id="categorie-nom"
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
      {current ? null : (
        <TextField
          id="categorie-code"
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
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="categorie-ordre"
          label={c.order}
          hint={c.orderHint}
          inputMode="numeric"
          value={draft.order}
          readOnly={readOnly}
          error={form.errors.order}
          onChange={(event) => change({ order: event.target.value })}
        />
        <TextField
          id="categorie-icone"
          label={t.icon}
          hint={t.iconHint}
          value={draft.icon}
          maxLength={50}
          readOnly={readOnly}
          error={form.errors.icon}
          onChange={(event) => change({ icon: event.target.value })}
        />
      </div>
      {feeHidden ? (
        <Note>{c.amountHiddenHint}</Note>
      ) : (
        <TextField
          id="categorie-frais"
          label={t.visitFee}
          hint={current?.visitFee ? t.visitFeeLocked : t.visitFeeHint}
          inputMode="numeric"
          value={draft.visitFee}
          readOnly={readOnly}
          error={form.errors.visitFee}
          onChange={(event) => change({ visitFee: event.target.value })}
          className="max-w-sm"
        />
      )}
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

/** Création d'une catégorie (`POST /admin/cleaning/place-categories`, clé d'idempotence). */
export function NewCategory() {
  const openCreated = useOpenCreated();
  return (
    <div className="grid gap-6">
      <DetailHeader backHref={paths.categories} title={t.newTitle} />
      <Panel title={d.summary} id="categorie-formulaire">
        <CategoryForm readOnly={false} onSaved={(category) => openCreated(paths.category(category.id))} />
      </Panel>
    </div>
  );
}

function CategoryPlaces({ categoryId, canManage }: { categoryId: string; canManage: boolean }) {
  const places = useResource(useCallback(() => listPlaceTypes(categoryId)(), [categoryId]));
  const p = catalogTexts.places;
  return (
    <Panel
      title={t.places}
      id="categorie-lieux"
      action={
        canManage ? (
          <ButtonLink href={paths.newPlace(categoryId)} variant="secondary">
            {t.addPlace}
          </ButtonLink>
        ) : undefined
      }
    >
      <ResourceView resource={places} lines={2}>
        {(page) =>
          page.data.length ? (
            <ul className="grid gap-2">
              {page.data.map((place: PlaceType) => (
                <li key={place.id} className="flex flex-wrap items-center gap-2">
                  <RowLink href={paths.place(place.id)}>{place.name}</RowLink>
                  <VisibilityBadge visible={place.publiclyVisible} reasons={place.visibilityReasons} />
                </li>
              ))}
            </ul>
          ) : (
            <Note>{p.empty}</Note>
          )
        }
      </ResourceView>
    </Panel>
  );
}

/** Fiche d'une catégorie : modification, activation et lieux rattachés. */
export function CategoryDetail({ id }: { id: string }) {
  const access = useCleaningAccess();
  const resource = useResource(useCallback(() => getPlaceCategory(id), [id]));
  const canManage = !!access?.['cleaning.catalog.manage'];
  return (
    <ResourceView resource={resource} lines={6}>
      {(category) => (
        <div className="grid gap-6">
          <DetailHeader
            backHref={paths.categories}
            title={category.name}
            badges={<ActiveBadge active={category.active} feminine />}
            updatedAt={category.updatedAt}
            updatedByName={category.updatedByName}
          />
          <CreatedNotice />
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Panel title={d.edit} id="categorie-formulaire">
              <p className="text-small text-ink-muted">
                {c.code} : <code>{category.code}</code>
              </p>
              {canManage ? null : <p className="text-small text-ink-muted">{c.readOnly}</p>}
              <CategoryForm
                key={category.id}
                current={category}
                readOnly={!canManage}
                onSaved={(saved) => resource.set(saved)}
              />
            </Panel>
            <div className="grid gap-6">
              <Panel title={d.activation} id="categorie-activation">
                <ActivationControl
                  name={category.name}
                  active={category.active}
                  feminine
                  canManage={canManage}
                  onChange={async (active) => resource.set(await updatePlaceCategory(id, { active }))}
                />
              </Panel>
              <CategoryPlaces categoryId={category.id} canManage={canManage} />
            </div>
          </div>
        </div>
      )}
    </ResourceView>
  );
}
