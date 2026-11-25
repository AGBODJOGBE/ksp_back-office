'use client';

import { ConfirmAction } from '@/components/ui/confirm-action';
import { TextAreaField } from '@/components/ui/select-field';
import { accountTexts } from '@/features/identity/account-admin-texts';
import { deactivateRole, updateRole } from '@/features/identity/roles-api';
import { roleError } from '@/features/identity/roles-errors';
import { permissionChanges, permissionLabel } from '@/features/identity/roles-logic';
import type { ManagedRole, Permission } from '@/features/identity/roles-schemas';
import { roleTexts } from '@/features/identity/roles-texts';
import { type RoleDraft, roleUpdate } from './role-fields';

const common = accountTexts.common;
const dialog = { cancel: common.cancel, pending: common.sending };

/** Ce qu'il faut faire d'une réponse : fiche à jour, ou relecture (rôle ou catalogue changés). */
export interface RoleCallbacks {
  onSaved: (role: ManagedRole, message: string) => void;
  onStale: () => void;
  onCatalogStale: () => void;
}

export function ReasonField({ id }: { id: string }) {
  return (
    <TextAreaField
      id={id}
      name="reason"
      label={common.reasonLabel}
      hint={common.reasonHint}
      maxLength={500}
      required
    />
  );
}

export const reasonOf = (data: FormData) => String(data.get('reason') ?? '').trim();

/** Envoie l'écriture ; renvoie le message à afficher dans la boîte, ou null si elle a réussi. */
export async function send(
  action: () => Promise<ManagedRole>,
  done: (role: ManagedRole) => void,
  callbacks: Pick<RoleCallbacks, 'onStale' | 'onCatalogStale'>,
): Promise<string | null> {
  try {
    done(await action());
    return null;
  } catch (error) {
    const outcome = roleError(error);
    if (outcome.refreshRole) callbacks.onStale();
    if (outcome.refreshCatalog) callbacks.onCatalogStale();
    return outcome.message;
  }
}

function ChangeList({
  title,
  codes,
  catalog,
}: {
  title: string;
  codes: string[];
  catalog: readonly Permission[];
}) {
  if (!codes.length) return null;
  return (
    <div className="grid gap-1">
      <p className="text-ink font-semibold">{title}</p>
      <ul className="text-ink grid max-h-40 list-disc gap-0.5 overflow-y-auto pl-5">
        {codes.map((code) => (
          <li key={code} className="break-words">
            {permissionLabel(code, catalog)}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** « Enregistrer » : résumé des permissions ajoutées et retirées et des autres champs, motif, envoi. */
export function SaveRole({
  role,
  draft,
  catalog,
  callbacks,
}: {
  role: ManagedRole;
  draft: RoleDraft;
  catalog: readonly Permission[];
  callbacks: RoleCallbacks;
}) {
  const t = roleTexts.update;
  const update = roleUpdate(role, draft);
  const { added, removed } = permissionChanges(role.permissions, draft.permissions);
  const fields = [
    update?.name !== undefined ? t.fieldName : null,
    update?.description !== undefined ? t.fieldDescription : null,
    update?.sensitive !== undefined ? t.fieldSensitive : null,
  ].filter(Boolean);
  return (
    <ConfirmAction
      label={roleTexts.form.save}
      title={t.title(role.name)}
      description={t.text}
      confirmLabel={t.confirm}
      labels={dialog}
      variant="action"
      disabled={!update}
      onConfirm={async (data) => {
        const reason = reasonOf(data);
        if (!update) return roleTexts.form.noChange;
        if (update.name !== undefined && !update.name) return roleTexts.form.nameRequired;
        if (!reason) return common.reasonRequired;
        return send(
          () => updateRole(role.code, { ...update, reason }),
          (saved) => callbacks.onSaved(saved, t.done),
          callbacks,
        );
      }}
    >
      <ChangeList title={t.added(added.length)} codes={added} catalog={catalog} />
      <ChangeList title={t.removed(removed.length)} codes={removed} catalog={catalog} />
      {fields.length ? (
        <p className="text-ink">
          <span className="font-semibold">{t.fields} : </span>
          {fields.join(', ')}.
        </p>
      ) : null}
      <ReasonField id="role-modification-motif" />
    </ConfirmAction>
  );
}

/** « Désactiver » : impossible tant que des comptes ont le rôle (le nombre vient de la fiche). */
export function DeactivateRole({ role, callbacks }: { role: ManagedRole; callbacks: RoleCallbacks }) {
  const t = roleTexts.deactivate;
  return (
    <ConfirmAction
      label={t.label}
      accessibleLabel={`${t.label} le rôle ${role.name}`}
      title={t.title(role.name)}
      description={
        <>
          <p>{t.text}</p>
          {role.activeAssignments > 0 ? (
            <p className="text-danger mt-2">{t.inUse(role.activeAssignments)}</p>
          ) : null}
        </>
      }
      confirmLabel={t.confirm}
      labels={dialog}
      danger
      onConfirm={async (data) => {
        const reason = reasonOf(data);
        if (!reason) return common.reasonRequired;
        return send(
          () => deactivateRole(role.code, reason),
          (saved) => callbacks.onSaved(saved, t.done),
          callbacks,
        );
      }}
    >
      <ReasonField id="role-desactivation-motif" />
    </ConfirmAction>
  );
}
