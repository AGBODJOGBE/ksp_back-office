'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { type FormEvent, useMemo, useState } from 'react';
import { ConfirmAction } from '@/components/ui/confirm-action';
import { TextField } from '@/components/ui/field';
import { ResponsiveTable, type TableColumn } from '@/components/ui/responsive-table';
import { SelectField } from '@/components/ui/select-field';
import { beninDay, formatDate } from '@/lib/format';
import { usePagedList } from '@/lib/use-paged-list';
import { createHoliday, deleteHoliday, listHolidays } from '@/features/cleaning/api';
import { attempt, loadErrorText } from '@/features/cleaning/errors';
import type { Holiday } from '@/features/cleaning/schemas';
import { settingsTexts } from '@/features/cleaning/settings-texts';
import { cleaningTexts } from '@/features/cleaning/texts';
import {
  type FieldErrors,
  FormFooter,
  ListState,
  Note,
  Panel,
  useCleaningAccess,
  useFormSubmit,
  useIdempotencyKey,
} from './parts';

const t = settingsTexts.holidays;
const c = cleaningTexts.common;

/** Années proposées : bornes du contrat (2020 à 2100), autour de l'année en cours au Bénin. */
const MIN_YEAR = 2020;
const MAX_YEAR = 2100;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Jour du calendrier (`AAAA-MM-JJ`) lu à midi au Bénin : jamais de glissement d'un jour. */
const holidayDate = (date: string) => formatDate(`${date}T12:00:00+01:00`);

function AddHoliday({ year, onAdded }: { year: number; onAdded: (holiday: Holiday) => void }) {
  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  const form = useFormSubmit(['date', 'name']);
  const idempotency = useIdempotencyKey();

  function submit(event: FormEvent) {
    const errors: FieldErrors = {};
    if (!DATE.test(date)) errors.date = c.required;
    if (!name.trim()) errors.name = c.required;
    else if (name.trim().length > 100) errors.name = c.tooLong(100);
    void form.submit(event, errors, async () => {
      try {
        const holiday = await createHoliday({ date, name: name.trim() }, idempotency.key());
        idempotency.settle();
        if (holiday.date.startsWith(String(year))) onAdded(holiday);
        setDate('');
        setName('');
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
          id="ferie-date"
          type="date"
          label={t.date}
          value={date}
          min={`${MIN_YEAR}-01-01`}
          max={`${MAX_YEAR}-12-31`}
          error={form.errors.date}
          onChange={(event) => setDate(event.target.value)}
        />
        <TextField
          id="ferie-nom"
          label={t.name}
          value={name}
          maxLength={100}
          error={form.errors.name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <FormFooter pending={form.pending} message={form.message} label={t.add} />
    </form>
  );
}

function columns(canManage: boolean, onRemoved: (holiday: Holiday) => void): TableColumn<Holiday>[] {
  return [
    { key: 'date', header: t.columns.date, primary: true, cell: (row) => holidayDate(row.date) },
    { key: 'name', header: t.columns.name, cell: (row) => row.name },
    ...(canManage
      ? [
          {
            key: 'actions',
            header: c.actions,
            cell: (row: Holiday) => (
              <ConfirmAction
                label={t.remove}
                accessibleLabel={`${t.remove} ${row.name}`}
                title={t.removeTitle(row.name)}
                description={t.removeText}
                confirmLabel={t.remove}
                labels={{ cancel: c.cancel, pending: c.sending }}
                danger
                onConfirm={() =>
                  attempt(async () => {
                    await deleteHoliday(row.id);
                    onRemoved(row);
                  })
                }
              />
            ),
          },
        ]
      : []),
  ];
}

function HolidayList({ year, canManage }: { year: number; canManage: boolean }) {
  const list = usePagedList(
    useMemo(() => listHolidays(year), [year]),
    loadErrorText,
  );
  const [added, setAdded] = useState<Holiday[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const rows = [...added, ...list.items.filter((item) => !added.some((holiday) => holiday.id === item.id))]
    .filter((holiday) => !removed.includes(holiday.id))
    .sort((a, b) => a.date.localeCompare(b.date));
  return (
    <div className="grid gap-6">
      {canManage ? (
        <Panel title={t.add} id="feries-ajout">
          <AddHoliday year={year} onAdded={(holiday) => setAdded((previous) => [...previous, holiday])} />
        </Panel>
      ) : null}
      <ListState list={{ ...list, items: rows }} empty={<Note>{t.empty(year)}</Note>}>
        <ResponsiveTable
          caption={t.caption(year)}
          columns={columns(canManage, (holiday) => setRemoved((previous) => [...previous, holiday.id]))}
          rows={rows}
          rowKey={(row) => row.id}
        />
      </ListState>
    </div>
  );
}

/** Jours fériés de l'année (`GET`, `POST`, `DELETE /admin/cleaning/holidays`), année dans l'adresse (`?annee=`). */
export function HolidaysScreen() {
  const access = useCleaningAccess();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const current = Number(beninDay(new Date()).slice(0, 4));
  const asked = Number(params.get('annee'));
  const year = Number.isInteger(asked) && asked >= MIN_YEAR && asked <= MAX_YEAR ? asked : current;
  const years = Array.from({ length: 5 }, (_, index) => current - 1 + index).filter(
    (value) => value >= MIN_YEAR && value <= MAX_YEAR,
  );
  if (!years.includes(year)) years.push(year);
  return (
    <div className="grid gap-6">
      <SelectField
        id="feries-annee"
        label={t.year}
        value={String(year)}
        onChange={(event) => router.replace(`${pathname}?annee=${event.target.value}`)}
        className="max-w-48"
      >
        {years.sort().map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </SelectField>
      <HolidayList key={year} year={year} canManage={!!access?.['cleaning.catalog.manage']} />
    </div>
  );
}
