'use client';

import { type FormEvent, useState } from 'react';
import { ConfirmAction } from '@/components/ui/confirm-action';
import { TextField } from '@/components/ui/field';
import { ResponsiveTable, type TableColumn } from '@/components/ui/responsive-table';
import { usePagedList } from '@/lib/use-paged-list';
import { createSkill, listSkills, updateSkill } from '@/features/cleaning/api';
import { catalogTexts } from '@/features/cleaning/catalog-texts';
import { attempt, loadErrorText } from '@/features/cleaning/errors';
import { CODE_PATTERN, codeFromLabel } from '@/features/cleaning/inputs';
import type { Skill } from '@/features/cleaning/schemas';
import { cleaningTexts } from '@/features/cleaning/texts';
import {
  ActionButton,
  ActiveBadge,
  type FieldErrors,
  FormFooter,
  ListState,
  Note,
  Panel,
  useCleaningAccess,
  useFormSubmit,
  useIdempotencyKey,
} from './parts';

const t = catalogTexts.skills;
const c = cleaningTexts.common;

function AddSkill({ onAdded }: { onAdded: (skill: Skill) => void }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [codeEdited, setCodeEdited] = useState(false);
  const form = useFormSubmit(['name', 'code']);
  const idempotency = useIdempotencyKey();

  function submit(event: FormEvent) {
    const errors: FieldErrors = {};
    if (!name.trim()) errors.name = c.required;
    else if (name.trim().length > 100) errors.name = c.tooLong(100);
    if (!CODE_PATTERN.test(code)) errors.code = c.invalidCode;
    void form.submit(event, errors, async () => {
      try {
        const skill = await createSkill({ code, name: name.trim() }, idempotency.key());
        idempotency.settle();
        onAdded(skill);
        setName('');
        setCode('');
        setCodeEdited(false);
      } catch (error) {
        idempotency.settle(error);
        throw error;
      }
    });
  }

  return (
    <form noValidate onSubmit={submit} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="competence-nom"
          label={t.name}
          value={name}
          maxLength={100}
          error={form.errors.name}
          onChange={(event) => {
            setName(event.target.value);
            if (!codeEdited) setCode(codeFromLabel(event.target.value));
          }}
        />
        <TextField
          id="competence-code"
          label={c.code}
          hint={c.codeHint}
          value={code}
          maxLength={50}
          spellCheck={false}
          autoComplete="off"
          error={form.errors.code}
          onChange={(event) => {
            setCode(event.target.value);
            setCodeEdited(true);
          }}
        />
      </div>
      <FormFooter pending={form.pending} message={form.message} label={t.add} />
    </form>
  );
}

function columns(canManage: boolean, onChange: (skill: Skill) => void): TableColumn<Skill>[] {
  return [
    { key: 'name', header: t.columns.name, primary: true, cell: (row) => row.name },
    { key: 'code', header: t.columns.code, cell: (row) => <code className="text-small">{row.code}</code> },
    { key: 'state', header: t.columns.state, cell: (row) => <ActiveBadge active={row.active} feminine /> },
    ...(canManage
      ? [
          {
            key: 'actions',
            header: c.actions,
            cell: (row: Skill) => (
              <span className="flex flex-wrap gap-2">
                <ConfirmAction
                  label={t.rename}
                  accessibleLabel={`${t.rename} ${row.name}`}
                  title={t.renameTitle(row.name)}
                  confirmLabel={c.save}
                  labels={{ cancel: c.cancel, pending: c.saving }}
                  onConfirm={(data) => {
                    const name = String(data.get('name') ?? '').trim();
                    if (!name) return Promise.resolve(c.required);
                    if (name.length > 100) return Promise.resolve(c.tooLong(100));
                    return attempt(async () => onChange(await updateSkill(row.id, { name })));
                  }}
                >
                  <TextField
                    id={`competence-${row.id}-nom`}
                    name="name"
                    label={t.newName}
                    defaultValue={row.name}
                    maxLength={100}
                  />
                </ConfirmAction>
                {row.active ? (
                  <ConfirmAction
                    label={c.deactivate}
                    accessibleLabel={`${c.deactivate} ${row.name}`}
                    title={t.deactivateTitle(row.name)}
                    description={t.deactivateText}
                    confirmLabel={c.deactivate}
                    labels={{ cancel: c.cancel, pending: c.sending }}
                    danger
                    onConfirm={() =>
                      attempt(async () => onChange(await updateSkill(row.id, { active: false })))
                    }
                  />
                ) : (
                  <ActionButton
                    label={c.reactivate}
                    accessibleLabel={`${c.reactivate} ${row.name}`}
                    onClick={async () => onChange(await updateSkill(row.id, { active: true }))}
                  />
                )}
              </span>
            ),
          },
        ]
      : []),
  ];
}

/** Compétences (`GET`, `POST`, `PATCH /admin/cleaning/skills`) : ajout, renommage, désactivation. */
export function SkillsScreen() {
  const access = useCleaningAccess();
  const list = usePagedList(listSkills, loadErrorText);
  const canManage = !!access?.['cleaning.catalog.manage'];
  // Les écritures remplacent la ligne affichée sans relire la liste.
  const [overrides, setOverrides] = useState<Record<string, Skill>>({});
  const [added, setAdded] = useState<Skill[]>([]);
  const replace = (skill: Skill) => setOverrides((previous) => ({ ...previous, [skill.id]: skill }));
  const rows = [...added, ...list.items.filter((item) => !added.some((skill) => skill.id === item.id))].map(
    (skill) => overrides[skill.id] ?? skill,
  );
  return (
    <div className="grid gap-6">
      {canManage ? (
        <Panel title={t.add} id="competences-ajout">
          <AddSkill onAdded={(skill) => setAdded((previous) => [skill, ...previous])} />
        </Panel>
      ) : null}
      <ListState list={{ ...list, items: rows }} empty={<Note>{t.empty}</Note>}>
        <ResponsiveTable
          caption={t.caption}
          columns={columns(canManage, replace)}
          rows={rows}
          rowKey={(row) => row.id}
        />
      </ListState>
    </div>
  );
}
