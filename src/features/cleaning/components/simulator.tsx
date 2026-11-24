'use client';

import { useSearchParams } from 'next/navigation';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { DescriptionList } from '@/components/ui/description-list';
import { FormMessage, TextField } from '@/components/ui/field';
import { ResponsiveTable, type TableColumn } from '@/components/ui/responsive-table';
import { SelectField } from '@/components/ui/select-field';
import { formatDate, formatDuration, formatXof } from '@/lib/format';
import { useResource } from '@/lib/use-resource';
import {
  allCleaningTypes,
  allOffers,
  allParameters,
  allPlaceTypes,
  allZones,
  listTariffs,
  type SchedulePlan,
  simulate,
  type Values,
} from '@/features/cleaning/api';
import { errorText } from '@/features/cleaning/errors';
import { formatCoefficient, parseInteger } from '@/features/cleaning/inputs';
import type {
  Money,
  Offer,
  Parameter,
  PricedOffer,
  PricingLine,
  Simulation,
} from '@/features/cleaning/schemas';
import { simulatorTexts } from '@/features/cleaning/simulator-texts';
import { cleaningTexts } from '@/features/cleaning/texts';
import { CheckField, FieldGroup } from './editors';
import { Amount, type FieldErrors, FormFooter, Note, Panel, ResourceView, useFormSubmit } from './parts';

const t = simulatorTexts;
const c = cleaningTexts.common;

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
type ScheduleKind = 'none' | SchedulePlan['kind'];

async function loadReferences() {
  const [places, types, parameters, zones] = await Promise.all([
    allPlaceTypes(),
    allCleaningTypes(),
    allParameters(),
    allZones(),
  ]);
  return { places, types, parameters, zones };
}
type References = Awaited<ReturnType<typeof loadReferences>>;

/** Offres du lieu et, pour celles qui ont un brouillon, l'identifiant de ce brouillon (`draftTariffIds`). */
async function loadPlaceOffers(placeTypeId: string) {
  const offers = await allOffers({ placeTypeId });
  const drafts = await Promise.all(
    offers.map(async (offer) => {
      if (offer.draftTariffVersion === null) return null;
      const page = await listTariffs(offer.id)();
      const draft = page.data.find((tariff) => tariff.status === 'draft');
      return draft ? ([offer.id, draft.id] as const) : null;
    }),
  );
  return { offers, drafts: new Map(drafts.filter((entry) => entry !== null)) };
}
type PlaceOffers = Awaited<ReturnType<typeof loadPlaceOffers>>;

interface Draft {
  placeTypeId: string;
  cleaningTypeIds: string[];
  draftTariffIds: string[];
  values: Record<string, string>;
  communeKey: string;
  kind: ScheduleKind;
  date: string;
  startDate: string;
  startTime: string;
  weekdays: string[];
  everyWeeks: string;
  durationWeeks: string;
  monthDays: string;
  durationMonths: string;
  excludeHolidays: boolean;
}

const split = (value: string | null) => (value ? value.split(',').filter(Boolean) : []);

function initialDraft(params: URLSearchParams): Draft {
  return {
    placeTypeId: params.get('lieu') ?? '',
    cleaningTypeIds: split(params.get('types')),
    draftTariffIds: split(params.get('brouillons')),
    values: {},
    communeKey: '',
    kind: 'none',
    date: '',
    startDate: '',
    startTime: '09:00',
    weekdays: [],
    everyWeeks: '1',
    durationWeeks: '',
    monthDays: '',
    durationMonths: '',
    excludeHolidays: true,
  };
}

/** Paramètres à renseigner : ceux du lieu, puis ceux des offres cochées, sans doublon. */
function askedParameters(draft: Draft, references: References, offers: Offer[]): Parameter[] {
  const place = references.places.find((item) => item.id === draft.placeTypeId);
  const chosen = offers.filter((offer) => draft.cleaningTypeIds.includes(offer.cleaningTypeId));
  const ids = [
    ...[...(place?.parameters ?? [])].sort((a, b) => a.order - b.order),
    ...chosen.flatMap((offer) => [...offer.extraParameters].sort((a, b) => a.order - b.order)),
  ].map((item) => item.parameterId);
  const byId = new Map(references.parameters.map((parameter) => [parameter.id, parameter]));
  return [...new Set(ids)].flatMap((id) => byId.get(id) ?? []);
}

const TIME = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

function validate(draft: Draft, parameters: Parameter[]): FieldErrors {
  const errors: FieldErrors = {};
  if (!draft.placeTypeId) errors.placeTypeId = c.required;
  if (!draft.cleaningTypeIds.length) errors.cleaningTypeIds = t.noType;
  for (const parameter of parameters) {
    const raw = draft.values[parameter.code] ?? '';
    if (parameter.kind === 'number' && raw.trim() && parseInteger(raw) === null) {
      errors[`values.${parameter.code}`] = c.invalidInteger;
    }
  }
  if (draft.kind !== 'none') {
    if (!TIME.test(draft.startTime)) errors['schedule.startTime'] = t.invalidTime;
    if (draft.kind === 'one_off' && !draft.date) errors['schedule.dates'] = c.required;
    if (draft.kind !== 'one_off' && !draft.startDate) errors['schedule.startDate'] = c.required;
    if (draft.kind === 'weekly') {
      if (!draft.weekdays.length) errors['schedule.weekdays'] = t.chooseWeekday;
      const every = parseInteger(draft.everyWeeks);
      if (every === null || every < 1 || every > 12) errors['schedule.everyWeeks'] = c.between(1, 12);
      const weeks = parseInteger(draft.durationWeeks);
      if (weeks === null || weeks < 1 || weeks > 260) errors['schedule.durationWeeks'] = c.between(1, 260);
    }
    if (draft.kind === 'monthly') {
      const days = monthDays(draft.monthDays);
      if (!days) errors['schedule.monthDays'] = t.invalidDays;
      const months = parseInteger(draft.durationMonths);
      if (months === null || months < 1 || months > 60) errors['schedule.durationMonths'] = c.between(1, 60);
    }
  }
  return errors;
}

function monthDays(raw: string): number[] | null {
  const days = raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map(parseInteger);
  if (!days.length || days.some((day) => day === null || day < 1 || day > 31)) return null;
  return [...new Set(days as number[])];
}

function scheduleOf(draft: Draft): SchedulePlan | undefined {
  const common = { startTime: draft.startTime, excludeHolidays: draft.excludeHolidays };
  if (draft.kind === 'one_off') return { kind: 'one_off', ...common, dates: [draft.date] };
  if (draft.kind === 'weekly') {
    return {
      kind: 'weekly',
      ...common,
      weekdays: draft.weekdays,
      everyWeeks: parseInteger(draft.everyWeeks) ?? 1,
      startDate: draft.startDate,
      durationWeeks: parseInteger(draft.durationWeeks) ?? 1,
    };
  }
  if (draft.kind === 'monthly') {
    return {
      kind: 'monthly',
      ...common,
      monthDays: monthDays(draft.monthDays) ?? [],
      startDate: draft.startDate,
      durationMonths: parseInteger(draft.durationMonths) ?? 1,
    };
  }
  return undefined;
}

function valuesOf(draft: Draft, parameters: Parameter[]): Values {
  const values: Values = {};
  for (const parameter of parameters) {
    const raw = (draft.values[parameter.code] ?? '').trim();
    if (!raw) continue;
    if (parameter.kind === 'number') values[parameter.code] = parseInteger(raw) ?? 0;
    else if (parameter.kind === 'boolean') values[parameter.code] = raw === 'true';
    else values[parameter.code] = raw;
  }
  return values;
}

/** Date du calendrier (`AAAA-MM-JJ`) lue à midi au Bénin, pour ne jamais glisser d'un jour. */
const day = (date: string) => formatDate(`${date}T12:00:00+01:00`);

function money(value: Money | null | undefined) {
  return <Amount value={value} />;
}

const lineColumns: TableColumn<PricingLine>[] = [
  { key: 'label', header: t.lines.label, primary: true, cell: (line) => line.label },
  {
    key: 'quantity',
    header: t.lines.quantity,
    className: 'tabular-nums',
    cell: (line) => line.quantity ?? '—',
  },
  {
    key: 'unit',
    header: t.lines.unit,
    cell: (line) => (line.unitAmount === null ? '—' : money(line.unitAmount)),
  },
  {
    key: 'coefficient',
    header: t.lines.coefficient,
    className: 'tabular-nums',
    cell: (line) => (line.coefficientBps === null ? '—' : formatCoefficient(line.coefficientBps)),
  },
  {
    key: 'amount',
    header: t.lines.amount,
    cell: (line) => (line.amount === null ? '—' : money(line.amount)),
  },
];

function OfferResult({ offer }: { offer: PricedOffer }) {
  return (
    <section aria-label={offer.name} className="rounded-card border-line grid gap-3 border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-ink font-semibold">{offer.name}</h4>
        <Badge tone={offer.status === 'priced' ? 'success' : 'warning'}>
          {t.offerStatuses[offer.status]}
          {offer.onQuoteReason ? ` : ${t.onQuoteReasons[offer.onQuoteReason]}` : ''}
        </Badge>
        {offer.tariffVersion === null ? (
          <Badge>{t.noTariff}</Badge>
        ) : (
          <Badge tone={offer.tariffStatus === 'draft' ? 'accent' : 'brand'}>
            {t.tariffVersion(
              offer.tariffVersion,
              offer.tariffStatus ? t.tariffStatus[offer.tariffStatus] : '—',
            )}
          </Badge>
        )}
        {offer.minimumApplied ? <Badge tone="warning">{t.minimumApplied}</Badge> : null}
      </div>
      {offer.price === null ? null : (
        <p className="font-display text-h3 text-ink font-semibold">{money(offer.price)}</p>
      )}
      {offer.lines.length ? (
        <ResponsiveTable
          caption={t.lines.caption(offer.name)}
          columns={lineColumns}
          rows={offer.lines}
          rowKey={(line) => `${line.kind}-${line.label}-${line.parameterCode ?? ''}`}
        />
      ) : null}
    </section>
  );
}

function range(value: { low?: Money; high?: Money } | null) {
  if (!value) return null;
  if (!value.low || !value.high) return c.amountHidden;
  return t.summary.rangeValue(formatXof(value.low), formatXof(value.high));
}

function SimulationResult({ result }: { result: Simulation }) {
  const { pricing, schedule } = result;
  const s = t.summary;
  return (
    <div className="grid gap-5" aria-live="polite">
      <div className="flex flex-wrap gap-2">
        <Badge tone={pricing.status === 'priced' ? 'success' : 'warning'} dot>
          {t.statuses[pricing.status]}
        </Badge>
        {result.usesDrafts ? <Badge tone="accent">{t.usesDrafts}</Badge> : null}
      </div>
      {result.notices.length ? (
        <ul className="grid gap-1">
          {result.notices.map((notice) => (
            <li key={notice} className="text-small text-ink">
              {t.notices[notice]}
            </li>
          ))}
        </ul>
      ) : null}
      <DescriptionList
        items={[
          { term: s.status, value: t.statuses[pricing.status] },
          { term: s.sessionPrice, value: pricing.sessionPrice === null ? null : money(pricing.sessionPrice) },
          { term: s.range, value: range(pricing.range) },
          {
            term: s.pricedSubtotal,
            value:
              pricing.status === 'partially_priced' && pricing.pricedSubtotal !== null
                ? money(pricing.pricedSubtotal)
                : null,
          },
          { term: s.packDiscount, value: pricing.packDiscount ? money(pricing.packDiscount) : null },
          {
            term: s.frequencyDiscount,
            value: pricing.frequencyDiscount ? money(pricing.frequencyDiscount) : null,
          },
          { term: s.commune, value: formatCoefficient(pricing.communeCoefficientBps) },
          { term: s.visitFee, value: pricing.visitFee === null ? null : money(pricing.visitFee) },
          { term: s.sessions, value: pricing.sessionsCount === null ? null : String(pricing.sessionsCount) },
          { term: s.programTotal, value: pricing.programTotal ? money(pricing.programTotal) : null },
          { term: s.programRange, value: range(pricing.programRange) },
          { term: s.team, value: pricing.teamSize === null ? null : s.agents(pricing.teamSize) },
          {
            term: s.duration,
            value: pricing.durationMinutes === null ? null : formatDuration(pricing.durationMinutes),
          },
        ]}
      />
      <div className="grid gap-3">
        {pricing.offers.map((offer) => (
          <OfferResult key={offer.offerId} offer={offer} />
        ))}
      </div>
      {schedule ? (
        <section aria-labelledby="simulation-dates" className="grid gap-2">
          <h4 id="simulation-dates" className="text-ink font-semibold">
            {t.scheduleResult.title}
          </h4>
          <p className="text-ink">
            {t.scheduleResult.count(schedule.count)}
            {schedule.occurrences.length
              ? ` · ${t.scheduleResult.span(
                  day((schedule.occurrences[0] as { date: string }).date),
                  day((schedule.occurrences.at(-1) as { date: string }).date),
                )}`
              : ''}
          </p>
          {schedule.notices.length ? (
            <ul className="text-small text-ink-muted grid gap-1">
              {schedule.notices.map((notice) => (
                <li key={`${notice.code}-${notice.date}`}>
                  {day(notice.date)} : {t.scheduleResult.notices[notice.code]}
                  {notice.label ? ` (${notice.label})` : ''}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
      <p className="text-small text-ink-muted">{result.disclaimer}</p>
    </div>
  );
}

function ParameterInput({
  parameter,
  value,
  error,
  onChange,
}: {
  parameter: Parameter;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const id = `simulation-${parameter.code}`;
  const label = `${parameter.label}${parameter.unit ? ` (${parameter.unit})` : ''}${parameter.required ? '' : ' — facultatif'}`;
  if (parameter.kind === 'number') {
    return (
      <TextField
        id={id}
        label={label}
        hint={parameter.help ?? undefined}
        inputMode="numeric"
        value={value}
        error={error}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }
  return (
    <SelectField
      id={id}
      label={label}
      hint={parameter.help ?? undefined}
      value={value}
      error={error}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">{t.noValue}</option>
      {parameter.kind === 'boolean' ? (
        <>
          <option value="true">{t.yes}</option>
          <option value="false">{t.no}</option>
        </>
      ) : (
        parameter.choices.map((choice) => (
          <option key={choice.code} value={choice.code}>
            {choice.label}
            {choice.active ? '' : ` (${c.inactiveFeminine.toLowerCase()})`}
          </option>
        ))
      )}
    </SelectField>
  );
}

function ScheduleFields({
  draft,
  errors,
  change,
}: {
  draft: Draft;
  errors: FieldErrors;
  change: (patch: Partial<Draft>) => void;
}) {
  return (
    <FieldGroup id="simulation-programme" legend={t.schedule} hint={t.scheduleHint}>
      <SelectField
        id="simulation-programme-type"
        label={t.schedule}
        value={draft.kind}
        onChange={(event) => change({ kind: event.target.value as ScheduleKind })}
        className="max-w-md"
      >
        {(['none', 'one_off', 'weekly', 'monthly'] as const).map((kind) => (
          <option key={kind} value={kind}>
            {t.scheduleKinds[kind]}
          </option>
        ))}
      </SelectField>
      {draft.kind === 'none' ? null : (
        <div className="grid gap-4 sm:grid-cols-2">
          {draft.kind === 'one_off' ? (
            <TextField
              id="simulation-date"
              type="date"
              label={t.date}
              value={draft.date}
              error={errors['schedule.dates']}
              onChange={(event) => change({ date: event.target.value })}
            />
          ) : (
            <TextField
              id="simulation-debut"
              type="date"
              label={t.startDate}
              value={draft.startDate}
              error={errors['schedule.startDate']}
              onChange={(event) => change({ startDate: event.target.value })}
            />
          )}
          <TextField
            id="simulation-heure"
            type="time"
            label={t.startTime}
            value={draft.startTime}
            error={errors['schedule.startTime']}
            onChange={(event) => change({ startTime: event.target.value })}
          />
          {draft.kind === 'weekly' ? (
            <>
              <FieldGroup id="simulation-jours" legend={t.weekdays} error={errors['schedule.weekdays']}>
                <div className="grid grid-cols-2 gap-1">
                  {WEEKDAYS.map((weekday) => (
                    <CheckField
                      key={weekday}
                      id={`simulation-jour-${weekday}`}
                      label={t.weekdayNames[weekday]}
                      checked={draft.weekdays.includes(weekday)}
                      onChange={(checked) =>
                        change({
                          weekdays: checked
                            ? WEEKDAYS.filter((item) => item === weekday || draft.weekdays.includes(item))
                            : draft.weekdays.filter((item) => item !== weekday),
                        })
                      }
                    />
                  ))}
                </div>
              </FieldGroup>
              <div className="grid content-start gap-4">
                <TextField
                  id="simulation-semaines"
                  label={t.everyWeeks}
                  inputMode="numeric"
                  value={draft.everyWeeks}
                  error={errors['schedule.everyWeeks']}
                  onChange={(event) => change({ everyWeeks: event.target.value })}
                />
                <TextField
                  id="simulation-duree-semaines"
                  label={t.durationWeeks}
                  inputMode="numeric"
                  value={draft.durationWeeks}
                  error={errors['schedule.durationWeeks']}
                  onChange={(event) => change({ durationWeeks: event.target.value })}
                />
              </div>
            </>
          ) : null}
          {draft.kind === 'monthly' ? (
            <>
              <TextField
                id="simulation-jours-mois"
                label={t.monthDays}
                hint={t.monthDaysHint}
                value={draft.monthDays}
                error={errors['schedule.monthDays']}
                onChange={(event) => change({ monthDays: event.target.value })}
              />
              <TextField
                id="simulation-duree-mois"
                label={t.durationMonths}
                inputMode="numeric"
                value={draft.durationMonths}
                error={errors['schedule.durationMonths']}
                onChange={(event) => change({ durationMonths: event.target.value })}
              />
            </>
          ) : null}
          <CheckField
            id="simulation-feries"
            label={t.excludeHolidays}
            checked={draft.excludeHolidays}
            onChange={(excludeHolidays) => change({ excludeHolidays })}
          />
        </div>
      )}
    </FieldGroup>
  );
}

function SimulatorForm({ references }: { references: References }) {
  const params = useSearchParams();
  const [draft, setDraft] = useState<Draft>(() => initialDraft(params));
  const [placeOffers, setPlaceOffers] = useState<{ id: string; data: PlaceOffers | null; error: unknown }>({
    id: '',
    data: null,
    error: null,
  });
  const [result, setResult] = useState<Simulation | null>(null);
  const form = useFormSubmit([
    'placeTypeId',
    'cleaningTypeIds',
    'values',
    'schedule',
    'communeKey',
    'draftTariffIds',
  ]);
  const change = (patch: Partial<Draft>) => setDraft((previous) => ({ ...previous, ...patch }));

  const placeId = draft.placeTypeId;
  useEffect(() => {
    if (!placeId) return;
    let active = true;
    loadPlaceOffers(placeId).then(
      (data) => active && setPlaceOffers({ id: placeId, data, error: null }),
      (error: unknown) => active && setPlaceOffers({ id: placeId, data: null, error }),
    );
    return () => {
      active = false;
    };
  }, [placeId]);

  const ready = placeOffers.id === placeId ? placeOffers : null;
  const offers = ready?.data?.offers ?? [];
  const place = references.places.find((item) => item.id === placeId);
  const parameters = askedParameters(draft, references, offers);
  const typeName = (id: string) => references.types.find((type) => type.id === id)?.name ?? id;

  function toggleType(offer: Offer, checked: boolean) {
    const draftId = ready?.data?.drafts.get(offer.id);
    change({
      cleaningTypeIds: checked
        ? [...draft.cleaningTypeIds, offer.cleaningTypeId]
        : draft.cleaningTypeIds.filter((id) => id !== offer.cleaningTypeId),
      draftTariffIds:
        checked || !draftId ? draft.draftTariffIds : draft.draftTariffIds.filter((id) => id !== draftId),
    });
  }

  function submit(event: FormEvent) {
    void form.submit(event, validate(draft, parameters), async () => {
      const drafts = new Set(ready?.data?.drafts.values() ?? []);
      setResult(
        await simulate({
          placeTypeId: draft.placeTypeId,
          cleaningTypeIds: draft.cleaningTypeIds,
          values: valuesOf(draft, parameters),
          schedule: scheduleOf(draft),
          communeKey: draft.communeKey || undefined,
          draftTariffIds: draft.draftTariffIds.filter((id) => drafts.has(id)),
        }),
      );
    });
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <Panel title={t.title} id="simulation-saisie">
        <form noValidate onSubmit={submit} className="grid gap-5">
          <SelectField
            id="simulation-lieu"
            label={t.place}
            value={draft.placeTypeId}
            error={form.errors.placeTypeId}
            onChange={(event) =>
              change({ placeTypeId: event.target.value, cleaningTypeIds: [], draftTariffIds: [], values: {} })
            }
          >
            <option value="">{t.choosePlace}</option>
            {references.places.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
                {item.active ? '' : ` (${c.inactive.toLowerCase()})`}
              </option>
            ))}
          </SelectField>
          {place?.freeDescription ? <FormMessage tone="info">{t.freePlace}</FormMessage> : null}
          {placeId ? (
            <FieldGroup
              id="simulation-types"
              legend={t.types}
              hint={t.typesHint}
              error={form.errors.cleaningTypeIds}
            >
              {ready === null ? (
                <Note>{c.loading}</Note>
              ) : ready.error ? (
                <FormMessage>{errorText(ready.error)}</FormMessage>
              ) : offers.length ? (
                offers.map((offer) => {
                  const draftId = ready.data?.drafts.get(offer.id);
                  const checked = draft.cleaningTypeIds.includes(offer.cleaningTypeId);
                  return (
                    <div key={offer.id} className="grid gap-1">
                      <CheckField
                        id={`simulation-type-${offer.id}`}
                        label={typeName(offer.cleaningTypeId)}
                        hint={[
                          offer.currentTariffVersion === null
                            ? t.onQuote
                            : t.published(offer.currentTariffVersion),
                          offer.active ? null : c.inactiveFeminine.toLowerCase(),
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                        checked={checked}
                        onChange={(value) => toggleType(offer, value)}
                      />
                      {draftId && offer.draftTariffVersion !== null && checked ? (
                        <div className="pl-8">
                          <CheckField
                            id={`simulation-brouillon-${offer.id}`}
                            label={t.useDraft(offer.draftTariffVersion)}
                            checked={draft.draftTariffIds.includes(draftId)}
                            onChange={(value) =>
                              change({
                                draftTariffIds: value
                                  ? [...draft.draftTariffIds, draftId]
                                  : draft.draftTariffIds.filter((id) => id !== draftId),
                              })
                            }
                          />
                        </div>
                      ) : null}
                    </div>
                  );
                })
              ) : (
                <Note>{t.noOffer}</Note>
              )}
            </FieldGroup>
          ) : null}
          {parameters.length ? (
            <FieldGroup id="simulation-valeurs" legend={t.values} hint={t.valuesHint}>
              <div className="grid gap-4 sm:grid-cols-2">
                {parameters.map((parameter) => (
                  <ParameterInput
                    key={parameter.id}
                    parameter={parameter}
                    value={draft.values[parameter.code] ?? ''}
                    error={form.errors[`values.${parameter.code}`]}
                    onChange={(value) => change({ values: { ...draft.values, [parameter.code]: value } })}
                  />
                ))}
              </div>
            </FieldGroup>
          ) : null}
          <SelectField
            id="simulation-commune"
            label={t.commune}
            hint={t.communeHint}
            value={draft.communeKey}
            error={form.errors.communeKey}
            onChange={(event) => change({ communeKey: event.target.value })}
            className="max-w-md"
          >
            <option value="">{t.noCommune}</option>
            {references.zones.map((zone) => (
              <option key={zone.id} value={zone.communeKey}>
                {zone.name}
                {zone.active ? '' : ` (${t.inactiveZone})`}
              </option>
            ))}
          </SelectField>
          <ScheduleFields draft={draft} errors={form.errors} change={change} />
          <FormFooter
            pending={form.pending}
            message={form.message}
            label={t.submit}
            pendingLabel={t.computing}
          />
        </form>
      </Panel>
      <Panel title={t.result} id="simulation-resultat">
        {result ? <SimulationResult result={result} /> : <Note>{t.lead}</Note>}
      </Panel>
    </div>
  );
}

/** Simulateur du back-office (`POST /admin/cleaning/simulations`), prérempli par `?lieu=&types=&brouillons=`. */
export function Simulator() {
  const references = useResource(useCallback(() => loadReferences(), []));
  return <ResourceView resource={references}>{(data) => <SimulatorForm references={data} />}</ResourceView>;
}
