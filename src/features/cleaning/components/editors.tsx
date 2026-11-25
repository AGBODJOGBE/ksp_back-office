'use client';

import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmAction } from '@/components/ui/confirm-action';
import { FieldError, TextField } from '@/components/ui/field';
import { catalogTexts } from '@/features/cleaning/catalog-texts';
import { attempt } from '@/features/cleaning/errors';
import { codeFromLabel, uniqueCode } from '@/features/cleaning/inputs';
import type { ChecklistItem } from '@/features/cleaning/schemas';
import { cleaningTexts } from '@/features/cleaning/texts';
import { ActionButton, ActiveBadge } from './parts';

const t = cleaningTexts.common;
const d = catalogTexts.detail;

/** Case à cocher de la charte : cible de 44 px, libellé et aide reliés. */
export function CheckField({
  id,
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex min-h-11 items-start gap-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        aria-describedby={hint ? `${id}-aide` : undefined}
        className="accent-action mt-1 size-5 shrink-0"
      />
      <label htmlFor={id} className="grid gap-0.5">
        <span className="text-ink font-semibold">{label}</span>
        {hint ? (
          <span id={`${id}-aide`} className="text-small text-ink-muted">
            {hint}
          </span>
        ) : null}
      </label>
    </div>
  );
}

/** Groupe de champs titré (`fieldset`), erreur du groupe sous la légende. */
export function FieldGroup({
  id,
  legend,
  hint,
  error,
  children,
}: {
  id: string;
  legend: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <fieldset
      className="grid min-w-0 gap-3"
      aria-describedby={
        [hint ? `${id}-aide` : null, error ? `${id}-erreur` : null].filter(Boolean).join(' ') || undefined
      }
    >
      <legend className="text-ink mb-1 font-semibold">{legend}</legend>
      {hint ? (
        <p id={`${id}-aide`} className="text-small text-ink-muted -mt-2">
          {hint}
        </p>
      ) : null}
      {error ? <FieldError id={`${id}-erreur`}>{error}</FieldError> : null}
      {children}
    </fieldset>
  );
}

/** Ligne d'une liste éditable (tranche, valeur, supplément) : titre lu, bouton « Retirer ». */
export function RowFrame({
  title,
  onRemove,
  error,
  id,
  children,
}: {
  title: string;
  onRemove?: () => void;
  error?: string;
  id: string;
  children: ReactNode;
}) {
  return (
    <div
      role="group"
      aria-labelledby={`${id}-titre`}
      className="rounded-control border-line grid gap-3 border p-3 sm:p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p id={`${id}-titre`} className="text-small text-ink font-semibold">
          {title}
        </p>
        {onRemove ? (
          <Button variant="ghost" onClick={onRemove} aria-label={t.remove(title)}>
            Retirer
          </Button>
        ) : null}
      </div>
      {error ? <FieldError id={`${id}-erreur`}>{error}</FieldError> : null}
      {children}
    </div>
  );
}

/** Déplace l'élément `index` d'un cran (`-1` : vers le haut). */
export function move<T>(items: readonly T[], index: number, step: -1 | 1): T[] {
  const target = index + step;
  if (target < 0 || target >= items.length) return [...items];
  const next = [...items];
  [next[index], next[target]] = [next[target] as T, next[index] as T];
  return next;
}

export interface PickOption {
  id: string;
  label: string;
  detail?: string;
  disabled?: boolean;
}

/**
 * Choix ordonné (paramètres d'un lieu, types d'un pack) : cases à cocher, puis la sélection rangée avec
 * « Monter » et « Descendre ». L'ordre de la sélection est celui envoyé à la gateway.
 */
export function OrderedPicker({
  id,
  legend,
  hint,
  options,
  value,
  onChange,
  error,
  empty,
  ordered = true,
}: {
  id: string;
  legend: string;
  hint?: ReactNode;
  options: readonly PickOption[];
  value: readonly string[];
  onChange: (value: string[]) => void;
  error?: string;
  empty: string;
  ordered?: boolean;
}) {
  const byId = new Map(options.map((option) => [option.id, option]));
  const toggle = (optionId: string, checked: boolean) =>
    onChange(checked ? [...value, optionId] : value.filter((item) => item !== optionId));
  return (
    <FieldGroup id={id} legend={legend} hint={hint} error={error}>
      {options.length ? (
        <div className="grid gap-1 sm:grid-cols-2">
          {options.map((option) => (
            <CheckField
              key={option.id}
              id={`${id}-${option.id}`}
              label={option.label}
              hint={option.detail}
              checked={value.includes(option.id)}
              disabled={option.disabled && !value.includes(option.id)}
              onChange={(checked) => toggle(option.id, checked)}
            />
          ))}
        </div>
      ) : (
        <p className="text-small text-ink-muted">{empty}</p>
      )}
      {ordered && value.length > 1 ? (
        <ol className="grid gap-2" aria-label={`${legend} : ordre`}>
          {value.map((optionId, index) => {
            const label = byId.get(optionId)?.label ?? optionId;
            return (
              <li
                key={optionId}
                className="rounded-control bg-surface-muted flex flex-wrap items-center justify-between gap-2 px-3 py-1"
              >
                <span className="text-ink">
                  <span className="text-ink-muted tabular-nums">{index + 1}. </span>
                  {label}
                </span>
                <span className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t.moveUp(label)}
                    disabled={index === 0}
                    onClick={() => onChange(move(value, index, -1))}
                  >
                    ↑
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t.moveDown(label)}
                    disabled={index === value.length - 1}
                    onClick={() => onChange(move(value, index, 1))}
                  >
                    ↓
                  </Button>
                </span>
              </li>
            );
          })}
        </ol>
      ) : null}
    </FieldGroup>
  );
}

/** Point de liste de contrôle en cours de saisie (`code` gardé pour un point déjà enregistré). */
export interface ChecklistDraft {
  code: string | null;
  label: string;
}

export const checklistDraft = (items: readonly ChecklistItem[]): ChecklistDraft[] =>
  [...items].sort((a, b) => a.order - b.order).map((item) => ({ code: item.code, label: item.label }));

/** Points saisis → `CleaningChecklistTemplateItem` : codes gardés, codes nouveaux tirés du libellé, ordre 0…n. */
export function checklistBody(items: readonly ChecklistDraft[]): ChecklistItem[] {
  const taken = items.flatMap((item) => (item.code ? [item.code] : []));
  return items.map((item, order) => {
    if (item.code) return { code: item.code, label: item.label.trim(), order };
    const code = uniqueCode(codeFromLabel(item.label), taken);
    taken.push(code);
    return { code, label: item.label.trim(), order };
  });
}

/** Erreurs locales d'une liste de contrôle (libellé obligatoire, 200 caractères). */
export function checklistErrors(items: readonly ChecklistDraft[], field: string): Record<string, string> {
  const errors: Record<string, string> = {};
  items.forEach((item, index) => {
    const label = item.label.trim();
    if (!label) errors[`${field}[${index}].label`] = t.required;
    else if (label.length > 200) errors[`${field}[${index}].label`] = t.tooLong(200);
  });
  return errors;
}

/** Liste de contrôle des séances : libellés ordonnés (ajouter, retirer, monter, descendre). */
export function ChecklistEditor({
  id,
  field,
  legend,
  hint,
  items,
  onChange,
  errors,
  readOnly = false,
}: {
  id: string;
  field: string;
  legend: string;
  hint?: ReactNode;
  items: readonly ChecklistDraft[];
  onChange: (items: ChecklistDraft[]) => void;
  errors: Record<string, string>;
  readOnly?: boolean;
}) {
  const c = catalogTexts.checklist;
  const update = (index: number, label: string) =>
    onChange(items.map((item, at) => (at === index ? { ...item, label } : item)));
  return (
    <FieldGroup id={id} legend={legend} hint={hint} error={errors[field]}>
      {items.length ? (
        <ol className="grid gap-2">
          {items.map((item, index) => {
            const label = c.item(index + 1);
            return (
              <li key={`${item.code ?? 'nouveau'}-${index}`} className="flex items-end gap-2">
                <TextField
                  id={`${id}-${index}`}
                  label={label}
                  value={item.label}
                  maxLength={200}
                  readOnly={readOnly}
                  error={errors[`${field}[${index}].label`] ?? errors[`${field}[${index}]`]}
                  onChange={(event) => update(index, event.target.value)}
                  className="min-w-0 flex-1"
                />
                {readOnly ? null : (
                  <span className="mb-0.5 flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t.moveUp(label)}
                      disabled={index === 0}
                      onClick={() => onChange(move(items, index, -1))}
                    >
                      ↑
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t.remove(label)}
                      onClick={() => onChange(items.filter((_, at) => at !== index))}
                    >
                      ✕
                    </Button>
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="text-small text-ink-muted">{c.empty}</p>
      )}
      {readOnly || items.length >= 50 ? null : (
        <Button
          variant="secondary"
          className="justify-self-start"
          onClick={() => onChange([...items, { code: null, label: '' }])}
        >
          {c.add}
        </Button>
      )}
    </FieldGroup>
  );
}

/**
 * Activation d'un élément du catalogue : désactiver demande une confirmation (il disparaît du
 * portail) ; activer ou réactiver se fait d'un geste. `onChange` envoie `active` à la gateway.
 */
export function ActivationControl({
  name,
  active,
  feminine = false,
  canManage,
  onChange,
  hint,
}: {
  name: string;
  active: boolean;
  feminine?: boolean;
  canManage: boolean;
  onChange: (active: boolean) => Promise<unknown>;
  hint?: string;
}) {
  return (
    <div className="grid justify-items-start gap-3">
      <ActiveBadge active={active} feminine={feminine} />
      {canManage ? (
        active ? (
          <ConfirmAction
            label={t.deactivate}
            accessibleLabel={`${t.deactivate} ${name}`}
            title={d.deactivateTitle(name)}
            description={d.deactivateText}
            confirmLabel={d.deactivateConfirm}
            labels={{ cancel: t.cancel, pending: t.sending }}
            danger
            onConfirm={() => attempt(() => onChange(false))}
          />
        ) : (
          <>
            {hint ? <p className="text-small text-ink-muted">{hint}</p> : null}
            <ActionButton
              label={d.activate}
              accessibleLabel={`${d.activate} ${name}`}
              variant="action"
              onClick={() => onChange(true)}
            />
          </>
        )
      ) : null}
    </div>
  );
}
