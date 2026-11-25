'use client';

import { TextField } from '@/components/ui/field';
import { TextAreaField } from '@/components/ui/select-field';
import { permissionChanges } from '@/features/identity/roles-logic';
import type { ManagedRole, Permission, UpdateRoleInput } from '@/features/identity/roles-schemas';
import { roleTexts } from '@/features/identity/roles-texts';
import { RolePermissionsField } from './role-permissions';

const t = roleTexts.form;

/** Brouillon d'un rôle : champs du formulaire de création ou de modification. */
export interface RoleDraft {
  code: string;
  name: string;
  description: string;
  sensitive: boolean;
  permissions: string[];
}

export const EMPTY_DRAFT: RoleDraft = {
  code: '',
  name: '',
  description: '',
  sensitive: false,
  permissions: [],
};

export function draftOf(role: ManagedRole): RoleDraft {
  const { code, name, description, sensitive, permissions } = role;
  return { code, name, description, sensitive, permissions: [...permissions] };
}

/**
 * Corps de `PATCH /roles/{code}` : seulement ce qui a changé (`permissions` remplace la liste entière),
 * sans le motif. `null` quand rien n'a changé.
 */
export function roleUpdate(role: ManagedRole, draft: RoleDraft): Omit<UpdateRoleInput, 'reason'> | null {
  const update: Omit<UpdateRoleInput, 'reason'> = {};
  const name = draft.name.trim();
  const description = draft.description.trim();
  if (name !== role.name) update.name = name;
  if (description !== role.description) update.description = description;
  if (draft.sensitive !== role.sensitive) update.sensitive = draft.sensitive;
  const { added, removed } = permissionChanges(role.permissions, draft.permissions);
  if (added.length || removed.length) update.permissions = [...draft.permissions];
  return Object.keys(update).length ? update : null;
}

/**
 * Champs d'un rôle : code (création seulement, définitif), nom, description, sensibilité, permissions
 * cochées. Contrôlés par la page, qui envoie après confirmation.
 */
export function RoleFields({
  draft,
  onChange,
  catalog,
  withCode = false,
  disabled,
}: {
  draft: RoleDraft;
  onChange: (draft: RoleDraft) => void;
  catalog: readonly Permission[];
  withCode?: boolean;
  disabled?: boolean;
}) {
  const set = (patch: Partial<RoleDraft>) => onChange({ ...draft, ...patch });
  const toggle = (code: string, checked: boolean) =>
    set({
      permissions: checked
        ? [...draft.permissions.filter((entry) => entry !== code), code]
        : draft.permissions.filter((entry) => entry !== code),
    });
  return (
    <div className="grid min-w-0 gap-5">
      <div className="grid gap-5 md:grid-cols-2">
        {withCode ? (
          <TextField
            id="role-code"
            label={t.code}
            hint={t.codeHint}
            value={draft.code}
            onChange={(event) => set({ code: event.target.value.trim().toLowerCase() })}
            maxLength={64}
            autoComplete="off"
            spellCheck={false}
            required
            disabled={disabled}
            inputClassName="font-mono"
          />
        ) : null}
        <TextField
          id="role-nom"
          label={t.name}
          value={draft.name}
          onChange={(event) => set({ name: event.target.value })}
          maxLength={80}
          required
          disabled={disabled}
        />
      </div>
      <TextAreaField
        id="role-description"
        name="description"
        label={t.description}
        hint={t.descriptionHint}
        value={draft.description}
        onChange={(event) => set({ description: event.target.value })}
        maxLength={500}
        disabled={disabled}
      />
      <div className="flex min-h-11 items-start gap-3">
        <input
          id="role-sensible"
          type="checkbox"
          checked={draft.sensitive}
          disabled={disabled}
          onChange={(event) => set({ sensitive: event.target.checked })}
          aria-describedby="role-sensible-aide"
          className="accent-action mt-1 size-5 shrink-0"
        />
        <label htmlFor="role-sensible" className="grid gap-0.5">
          <span className="text-ink font-semibold">{t.sensitive}</span>
          <span id="role-sensible-aide" className="text-small text-ink-muted">
            {t.sensitiveHint}
          </span>
        </label>
      </div>
      <RolePermissionsField
        catalog={catalog}
        selected={draft.permissions}
        onToggle={toggle}
        disabled={disabled}
      />
    </div>
  );
}
