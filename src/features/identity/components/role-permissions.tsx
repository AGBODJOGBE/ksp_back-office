'use client';

import { Badge } from '@/components/ui/badge';
import { serviceLabel } from '@/features/identity/account-admin-texts';
import { groupPermissions, permissionLabel } from '@/features/identity/roles-logic';
import type { Permission } from '@/features/identity/roles-schemas';
import { moduleLabel, roleTexts } from '@/features/identity/roles-texts';

const t = roleTexts;

/** Une case : description lisible du catalogue, code en aide (repère pour le support). */
function PermissionBox({
  permission,
  checked,
  disabled,
  onToggle,
}: {
  permission: { code: string; description: string; retired: boolean };
  checked: boolean;
  disabled?: boolean;
  onToggle: (code: string, checked: boolean) => void;
}) {
  const id = `permission-${permission.code.replace(/\./g, '-')}`;
  return (
    <li className="flex min-h-11 items-start gap-3">
      <input
        id={id}
        type="checkbox"
        name="permission"
        value={permission.code}
        checked={checked}
        disabled={disabled}
        onChange={(event) => onToggle(permission.code, event.target.checked)}
        aria-describedby={`${id}-code`}
        className="accent-action mt-1 size-5 shrink-0"
      />
      <label htmlFor={id} className="grid min-w-0 gap-0.5">
        <span className="text-ink font-semibold break-words">
          {permission.description || permission.code}
          {permission.retired ? (
            <Badge tone="warning" className="ml-2 align-middle">
              {t.detail.retired}
            </Badge>
          ) : null}
        </span>
        <span id={`${id}-code`} className="text-small text-ink-muted font-mono break-all">
          {permission.code}
        </span>
      </label>
    </li>
  );
}

/**
 * Cases des permissions d'un rôle, groupées par service puis module (R-RB-01). Les permissions cochées
 * que le catalogue ne déclare plus restent affichées, marquées « Retirée », pour pouvoir les décocher.
 */
export function RolePermissionsField({
  catalog,
  selected,
  onToggle,
  disabled,
}: {
  catalog: readonly Permission[];
  selected: readonly string[];
  onToggle: (code: string, checked: boolean) => void;
  disabled?: boolean;
}) {
  const known = new Set(catalog.map((entry) => entry.code));
  const orphans = selected
    .filter((code) => !known.has(code))
    .map((code) => ({ code, description: '', retired: true }));
  const groups = groupPermissions(catalog);
  return (
    <fieldset className="grid min-w-0 gap-4">
      <legend className="text-ink font-semibold">
        {t.form.permissions}{' '}
        <span className="text-small text-ink-muted font-normal">({t.form.selected(selected.length)})</span>
      </legend>
      <p className="text-small text-ink-muted -mt-2">{t.form.permissionsHint}</p>
      {groups.length === 0 && orphans.length === 0 ? (
        <p className="text-small text-ink-muted">{t.form.noPermission}</p>
      ) : null}
      {groups.map((group) => (
        <fieldset key={group.service} className="border-line rounded-card grid min-w-0 gap-3 border p-4">
          <legend className="font-display px-1 font-semibold">{serviceLabel(group.service)}</legend>
          {group.modules.map((block) => (
            <fieldset key={block.module} className="grid min-w-0 gap-1">
              <legend className="text-small text-ink-muted mb-1 font-semibold">
                {moduleLabel(block.module)}
              </legend>
              <ul className="grid gap-1 md:grid-cols-2 md:gap-x-6">
                {block.permissions.map((permission) => (
                  <PermissionBox
                    key={permission.code}
                    permission={permission}
                    checked={selected.includes(permission.code)}
                    disabled={disabled}
                    onToggle={onToggle}
                  />
                ))}
              </ul>
            </fieldset>
          ))}
        </fieldset>
      ))}
      {orphans.length ? (
        <fieldset className="border-warning/50 rounded-card grid min-w-0 gap-3 border p-4">
          <legend className="font-display px-1 font-semibold">{t.detail.retired}</legend>
          <ul className="grid gap-1">
            {orphans.map((permission) => (
              <PermissionBox
                key={permission.code}
                permission={permission}
                checked
                disabled={disabled}
                onToggle={onToggle}
              />
            ))}
          </ul>
        </fieldset>
      ) : null}
    </fieldset>
  );
}

/** Liste en lecture des permissions d'un rôle, groupées comme les cases ; retirées signalées. */
export function RolePermissionsList({
  catalog,
  granted,
}: {
  catalog: readonly Permission[];
  granted: readonly string[];
}) {
  const byCode = new Map(catalog.map((entry) => [entry.code, entry]));
  const kept = catalog.filter((entry) => granted.includes(entry.code));
  const unknown = granted.filter((code) => !byCode.has(code));
  return (
    <div className="grid gap-4">
      {groupPermissions(kept).map((group) => (
        <section key={group.service} className="grid gap-2" aria-label={serviceLabel(group.service)}>
          <h3 className="font-display font-semibold">{serviceLabel(group.service)}</h3>
          {group.modules.map((block) => (
            <div key={block.module} className="grid gap-1">
              <p className="text-small text-ink-muted font-semibold">{moduleLabel(block.module)}</p>
              <ul className="grid gap-1 md:grid-cols-2 md:gap-x-6">
                {block.permissions.map((permission) => (
                  <li key={permission.code} className="break-words">
                    {permissionLabel(permission.code, catalog)}
                    {permission.retired ? (
                      <Badge tone="warning" className="ml-2 align-middle">
                        {t.detail.retired}
                      </Badge>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}
      {unknown.length ? (
        <ul className="grid gap-1">
          {unknown.map((code) => (
            <li key={code} className="font-mono break-all">
              {code}
              <Badge tone="warning" className="ml-2 align-middle">
                {t.detail.retired}
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
