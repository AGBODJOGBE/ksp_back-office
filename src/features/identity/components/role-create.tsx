'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { BackLink } from '@/components/ui/back-link';
import { ConfirmAction } from '@/components/ui/confirm-action';
import { Heading } from '@/components/ui/heading';
import { ResourceView } from '@/components/ui/resource-view';
import { apiErrorText } from '@/lib/api';
import { useResource } from '@/lib/use-resource';
import { accountTexts } from '@/features/identity/account-admin-texts';
import { createRole, listPermissions } from '@/features/identity/roles-api';
import { ROLE_CODE } from '@/features/identity/roles-schemas';
import { rolePaths, roleTexts } from '@/features/identity/roles-texts';
import { ReasonField, reasonOf, send } from './role-actions';
import { EMPTY_DRAFT, type RoleDraft, RoleFields } from './role-fields';

const t = roleTexts.createDialog;
const common = accountTexts.common;
const dialog = { cancel: common.cancel, pending: common.sending };

/** Erreur de saisie à montrer avant l'envoi, ou null. */
function draftError(draft: RoleDraft): string | null {
  if (!ROLE_CODE.test(draft.code)) return roleTexts.form.codeInvalid;
  if (!draft.name.trim()) return roleTexts.form.nameRequired;
  return null;
}

/**
 * Création d'un rôle (`super_admin`, R-RB-02) : code définitif, nom, description, sensibilité, cases
 * des permissions déclarées par les services ; confirmation avec motif, puis ouverture de sa fiche.
 */
export function RoleCreateView() {
  const router = useRouter();
  const catalog = useResource(useCallback(() => listPermissions(), []));
  const [draft, setDraft] = useState<RoleDraft>(EMPTY_DRAFT);
  const name = draft.name.trim();

  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <BackLink href={rolePaths.list}>{roleTexts.detail.back}</BackLink>
        <Heading as="h1" size="h2">
          {t.heading}
        </Heading>
        <p className="text-ink-muted max-w-reading">{t.lead}</p>
      </div>
      <ResourceView resource={catalog} lines={6} labels={common} describe={apiErrorText}>
        {(permissions) => (
          <div className="rounded-card border-line bg-surface grid gap-6 border p-4 sm:p-6">
            <RoleFields draft={draft} onChange={setDraft} catalog={permissions} withCode />
            <div className="flex flex-wrap justify-end gap-3">
              <ConfirmAction
                label={roleTexts.form.create}
                title={t.title(name || draft.code)}
                description={t.text(draft.permissions.length)}
                confirmLabel={t.confirm}
                labels={dialog}
                variant="action"
                onConfirm={async (data) => {
                  const invalid = draftError(draft);
                  if (invalid) return invalid;
                  const reason = reasonOf(data);
                  if (!reason) return common.reasonRequired;
                  const description = draft.description.trim();
                  return send(
                    () =>
                      createRole({
                        code: draft.code,
                        name,
                        ...(description ? { description } : {}),
                        permissions: draft.permissions,
                        sensitive: draft.sensitive,
                        reason,
                      }),
                    (role) => router.push(rolePaths.role(role.code)),
                    { onStale: () => undefined, onCatalogStale: catalog.refresh },
                  );
                }}
              >
                <ReasonField id="role-creation-motif" />
              </ConfirmAction>
            </div>
          </div>
        )}
      </ResourceView>
    </div>
  );
}
