'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { type FormEvent, useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { ResponsiveTable, type TableColumn } from '@/components/ui/responsive-table';
import { SelectField } from '@/components/ui/select-field';
import { beninDay, formatDate } from '@/lib/format';
import { useResource } from '@/lib/use-resource';
import { getHolidays, setHolidays } from '@/features/recovery/settings-api';
import { type Holiday, HOLIDAY_YEARS, MAX_HOLIDAYS } from '@/features/recovery/settings-schemas';
import { settingsTexts } from '@/features/recovery/settings-texts';
import { recoveryTexts } from '@/features/recovery/texts';
import {
  type FieldErrors,
  FormFooter,
  Note,
  Panel,
  ResourceView,
  useFormSubmit,
  useRecoveryAccess,
} from './parts';

const t = settingsTexts.holidays;
const c = recoveryTexts.common;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Jour du calendrier lu à midi au Bénin : jamais de glissement d'un jour. */
const noon = (date: string) => `${date}T12:00:00+01:00`;
/** Samedi ou dimanche : déjà hors des jours ouvrés (lundi à vendredi). */
const isWeekend = (date: string) => [0, 6].includes(new Date(noon(date)).getUTCDay());

function AddHoliday({
  year,
  list,
  onAdd,
}: {
  year: number;
  list: Holiday[];
  onAdd: (holiday: Holiday) => void;
}) {
  const [date, setDate] = useState('');
  const [label, setLabel] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});

  function submit(event: FormEvent) {
    event.preventDefault();
    const found: FieldErrors = {};
    if (!DATE.test(date)) found.date = c.required;
    else if (!date.startsWith(`${year}-`)) found.date = t.otherYear(year);
    else if (list.some((holiday) => holiday.date === date)) found.date = t.duplicate;
    if (!label.trim()) found.label = c.required;
    else if (label.trim().length > 100) found.label = c.tooLong(100);
    if (list.length >= MAX_HOLIDAYS) found.date = t.max;
    setErrors(found);
    if (Object.keys(found).length) return;
    onAdd({ date, label: label.trim() });
    setDate('');
    setLabel('');
  }

  return (
    <form noValidate onSubmit={submit} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="ferie-date"
          type="date"
          label={t.date}
          value={date}
          min={`${year}-01-01`}
          max={`${year}-12-31`}
          error={errors.date}
          onChange={(event) => setDate(event.target.value)}
        />
        <TextField
          id="ferie-libelle"
          label={t.label}
          value={label}
          maxLength={100}
          error={errors.label}
          onChange={(event) => setLabel(event.target.value)}
        />
      </div>
      <Button type="submit" variant="secondary" className="justify-self-start">
        {t.add}
      </Button>
    </form>
  );
}

function HolidayEditor({
  year,
  initial,
  canManage,
}: {
  year: number;
  initial: Holiday[];
  canManage: boolean;
}) {
  const [list, setList] = useState(() => [...initial].sort((a, b) => a.date.localeCompare(b.date)));
  const [dirty, setDirty] = useState(false);
  const form = useFormSubmit(['holidays']);
  const update = (next: Holiday[]) => {
    setList([...next].sort((a, b) => a.date.localeCompare(b.date)));
    setDirty(true);
  };

  const columns: TableColumn<Holiday>[] = [
    { key: 'date', header: t.date, primary: true, cell: (row) => formatDate(noon(row.date)) },
    {
      key: 'label',
      header: t.label,
      cell: (row) => (
        <span className="grid gap-0.5">
          {row.label}
          {isWeekend(row.date) ? <span className="text-small text-ink-muted">{t.weekend}</span> : null}
        </span>
      ),
    },
    ...(canManage
      ? [
          {
            key: 'actions',
            header: c.actions,
            cell: (row: Holiday) => (
              <Button
                variant="danger"
                aria-label={t.removeLabel(row.label)}
                onClick={() => update(list.filter((item) => item.date !== row.date))}
              >
                {t.remove}
              </Button>
            ),
          },
        ]
      : []),
  ];

  function save(event: FormEvent) {
    void form.submit(event, {}, async () => {
      const saved = await setHolidays(year, list);
      setList([...saved].sort((a, b) => a.date.localeCompare(b.date)));
      setDirty(false);
      return t.saved;
    });
  }

  return (
    <div className="grid gap-6">
      {canManage ? (
        <Panel title={t.addTitle} id="feries-ajout">
          <AddHoliday year={year} list={list} onAdd={(holiday) => update([...list, holiday])} />
        </Panel>
      ) : (
        <Note>{t.readOnly}</Note>
      )}
      {list.length ? (
        <ResponsiveTable caption={t.caption(year)} columns={columns} rows={list} rowKey={(row) => row.date} />
      ) : (
        <Note>{t.empty(year)}</Note>
      )}
      {canManage ? (
        <form noValidate onSubmit={save} className="grid gap-2">
          <FormFooter
            pending={form.pending}
            message={form.message}
            success={form.success}
            label={t.save}
            extra={dirty ? <span className="text-small text-warning font-semibold">{t.unsaved}</span> : null}
          />
        </form>
      ) : null}
    </div>
  );
}

function YearHolidays({ year, canManage }: { year: number; canManage: boolean }) {
  const load = useCallback(() => getHolidays(year), [year]);
  const resource = useResource(load);
  return (
    <ResourceView resource={resource}>
      {(holidays) => <HolidayEditor year={year} initial={holidays} canManage={canManage} />}
    </ResourceView>
  );
}

/** Jours fériés d'une année (`GET`, `PUT /recovery/holidays/{year}`), année dans l'adresse (`?annee=`). */
export function HolidaysScreen() {
  const access = useRecoveryAccess();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [min, max] = HOLIDAY_YEARS;
  const current = Number(beninDay(new Date()).slice(0, 4));
  const asked = Number(params.get('annee'));
  const year = Number.isInteger(asked) && asked >= min && asked <= max ? asked : current;
  const years = Array.from({ length: 4 }, (_, index) => current - 1 + index).filter(
    (value) => value >= min && value <= max,
  );
  if (!years.includes(year)) years.push(year);
  return (
    <div className="grid gap-6">
      <SelectField
        id="feries-annee"
        label={t.year}
        value={String(year)}
        className="max-w-48"
        onChange={(event) => router.replace(`${pathname}?annee=${event.target.value}`)}
      >
        {years
          .sort((a, b) => a - b)
          .map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
      </SelectField>
      <YearHolidays key={year} year={year} canManage={!!access?.holidaysManage} />
    </div>
  );
}
