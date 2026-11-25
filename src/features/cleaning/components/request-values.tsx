'use client';

import { TextField } from '@/components/ui/field';
import { SelectField } from '@/components/ui/select-field';
import {
  allCleaningTypes,
  allOffers,
  allParameters,
  getPlaceType,
  type Values,
} from '@/features/cleaning/api';
import { parseInteger } from '@/features/cleaning/inputs';
import type { CleaningValues } from '@/features/cleaning/requests-schemas';
import { retainedTexts } from '@/features/cleaning/request-work-texts';
import type { Parameter } from '@/features/cleaning/schemas';
import { cleaningTexts } from '@/features/cleaning/texts';
import type { FieldErrors } from './parts';

const c = cleaningTexts.common;
const r = retainedTexts;

/** Catalogue utile à la saisie d'un constat : paramètres, lieu, offres du lieu et types. */
export async function loadValueReferences(placeTypeId: string) {
  const [parameters, place, offers, types] = await Promise.all([
    allParameters(),
    getPlaceType(placeTypeId),
    allOffers({ placeTypeId }),
    allCleaningTypes(),
  ]);
  return { parameters, place, offers, types };
}
export type ValueReferences = Awaited<ReturnType<typeof loadValueReferences>>;

/** Paramètres à renseigner : ceux du lieu, puis ceux des offres des types choisis, sans doublon. */
export function askedParameters(refs: ValueReferences, cleaningTypeIds: readonly string[]): Parameter[] {
  const chosen = refs.offers.filter((offer) => cleaningTypeIds.includes(offer.cleaningTypeId));
  const ids = [
    ...[...refs.place.parameters].sort((a, b) => a.order - b.order),
    ...chosen.flatMap((offer) => [...offer.extraParameters].sort((a, b) => a.order - b.order)),
  ].map((item) => item.parameterId);
  const byId = new Map(refs.parameters.map((parameter) => [parameter.id, parameter]));
  return [...new Set(ids)].flatMap((id) => byId.get(id) ?? []);
}

/** Saisie en cours : code du paramètre → texte du champ. */
export type ValueDraft = Record<string, string>;

export const draftOf = (values: CleaningValues | null | undefined): ValueDraft =>
  Object.fromEntries(Object.entries(values ?? {}).map(([code, value]) => [code, String(value)]));

/** Valeurs envoyées : champ vide = absent ; nombre entier, oui/non ou code de choix. */
export function valuesOf(draft: ValueDraft, parameters: readonly Parameter[]): Values {
  const values: Values = {};
  for (const parameter of parameters) {
    const raw = (draft[parameter.code] ?? '').trim();
    if (!raw) continue;
    if (parameter.kind === 'number') values[parameter.code] = parseInteger(raw) ?? 0;
    else if (parameter.kind === 'boolean') values[parameter.code] = raw === 'true';
    else values[parameter.code] = raw;
  }
  return values;
}

/** Contrôles locaux : obligatoire, entier, bornes du paramètre. Clés `values.<code>`. */
export function valueErrors(draft: ValueDraft, parameters: readonly Parameter[]): FieldErrors {
  const errors: FieldErrors = {};
  for (const parameter of parameters) {
    const raw = (draft[parameter.code] ?? '').trim();
    const field = `values.${parameter.code}`;
    if (!raw) {
      if (parameter.required) errors[field] = c.required;
      continue;
    }
    if (parameter.kind !== 'number') continue;
    const value = parseInteger(raw);
    if (value === null) errors[field] = c.invalidInteger;
    else if (
      (parameter.min !== null && value < parameter.min) ||
      (parameter.max !== null && value > parameter.max)
    ) {
      errors[field] = c.between(parameter.min ?? 0, parameter.max ?? value);
    }
  }
  return errors;
}

/** Un champ par paramètre : nombre, oui/non ou choix. */
export function ValueFields({
  idPrefix,
  parameters,
  draft,
  errors,
  onChange,
  disabled,
}: {
  idPrefix: string;
  parameters: readonly Parameter[];
  draft: ValueDraft;
  errors: FieldErrors;
  onChange: (code: string, value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {parameters.map((parameter) => {
        const id = `${idPrefix}-${parameter.code}`;
        const label = `${parameter.label}${parameter.unit ? ` (${parameter.unit})` : ''}${parameter.required ? '' : ' — facultatif'}`;
        const common = {
          id,
          label,
          hint: parameter.help ?? undefined,
          value: draft[parameter.code] ?? '',
          error: errors[`values.${parameter.code}`],
          disabled,
        };
        if (parameter.kind === 'number') {
          return (
            <TextField
              key={parameter.code}
              {...common}
              inputMode="numeric"
              onChange={(event) => onChange(parameter.code, event.target.value)}
            />
          );
        }
        return (
          <SelectField
            key={parameter.code}
            {...common}
            onChange={(event) => onChange(parameter.code, event.target.value)}
          >
            <option value="">{r.noValue}</option>
            {parameter.kind === 'boolean' ? (
              <>
                <option value="true">{r.yes}</option>
                <option value="false">{r.no}</option>
              </>
            ) : (
              parameter.choices.map((choice) => (
                <option key={choice.code} value={choice.code}>
                  {choice.label}
                </option>
              ))
            )}
          </SelectField>
        );
      })}
    </div>
  );
}
