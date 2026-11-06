'use client';

import type { ReactNode } from 'react';
import { DescriptionList } from '@/components/ui/description-list';
import { Heading } from '@/components/ui/heading';
import { formatSlot, formatXof } from '@/lib/format';
import { requestTexts as t } from '@/features/cleaning/request-detail-texts';
import type {
  AnswerSummary,
  FormField,
  GeoLocation,
  QuoteRequest,
  ServiceForm,
} from '@/features/cleaning/schemas';
import { cleaningTexts, customerKind, nameOr, recurrenceText } from '@/features/cleaning/texts';
import { Note } from './parts';
import { CalculationDetails } from './price-panel';
import { useServiceForm } from './use-service-names';

const common = cleaningTexts.common;
const f = t.fields;

const decimal = new Intl.NumberFormat('fr-BJ', { maximumFractionDigits: 6 });

/** Bloc titré à l'intérieur d'une étape (titre de niveau 3). */
export function Block({ title, id, children }: { title: string; id: string; children: ReactNode }) {
  return (
    <section
      aria-labelledby={id}
      className="rounded-card border-line bg-surface grid min-w-0 content-start gap-4 border p-4 sm:p-5"
    >
      <Heading as="h3" size="h3" id={id} className="text-lg">
        {title}
      </Heading>
      {children}
    </section>
  );
}

/** Lien vers la position sur une carte (nouvel onglet) : le repère reste la référence sur place. */
export const mapUrl = (location: GeoLocation) =>
  `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`;

/** Position : coordonnées, précision et lien « Voir sur la carte ». */
export function PositionText({ location }: { location: GeoLocation }) {
  return (
    <span className="grid">
      <span className="tabular-nums">
        {t.coordinates(decimal.format(location.latitude), decimal.format(location.longitude))}
      </span>
      <span className="text-small text-ink-muted">
        {f.accuracy} :{' '}
        {location.accuracyMeters !== null
          ? t.accuracy(decimal.format(Math.round(location.accuracyMeters)))
          : t.accuracyUnknown}
      </span>
      <a
        href={mapUrl(location)}
        target="_blank"
        rel="noopener noreferrer"
        className="text-accent-ink min-h-11 content-center font-semibold underline"
      >
        {t.map}
        <span className="sr-only"> {t.newTab}</span>
      </a>
    </span>
  );
}

/** Réponses lisibles (`answerSummary`) : une ligne par champ, puis chaque option et ses champs, puis la fréquence. */
export function SummaryList({ summary }: { summary: AnswerSummary }) {
  return (
    <div className="grid gap-4">
      {summary.fields.length ? (
        <DescriptionList
          items={summary.fields.map((field) => ({ term: field.label, value: field.display }))}
        />
      ) : (
        <Note>{t.noAnswers}</Note>
      )}
      {summary.options.map((option) => (
        <div key={option.optionCode} className="border-line grid gap-2 border-l-2 pl-3">
          <p className="text-ink font-semibold">{t.option(option.label)}</p>
          {option.fields.length ? (
            <DescriptionList
              items={option.fields.map((field) => ({ term: field.label, value: field.display }))}
            />
          ) : null}
        </div>
      ))}
      {summary.frequency ? (
        <DescriptionList items={[{ term: f.frequency, value: summary.frequency.label }]} />
      ) : null}
    </div>
  );
}

/** Repli sans `answerSummary` (gateway antérieure à l'ADR-037) : libellés tirés du formulaire public. */
function answerValue(value: number | string | boolean, field: FormField | undefined): string {
  if (typeof value === 'boolean') return value ? t.yes : t.no;
  if (typeof value === 'number') return field?.unitLabel ? `${value} ${field.unitLabel}` : String(value);
  return field?.choices.find((choice) => choice.code === value)?.label ?? value;
}

function answerItems(answers: Record<string, number | string | boolean>, fields: readonly FormField[]) {
  return Object.entries(answers).map(([code, value]) => {
    const field = fields.find((item) => item.code === code);
    return { term: field?.label ?? code, value: answerValue(value, field) };
  });
}

function RawAnswers({ request, form }: { request: QuoteRequest; form: ServiceForm | null }) {
  if (!request.answers) {
    return (
      <div className="grid gap-3">
        <Note>{t.legacyAnswers}</Note>
        <DescriptionList items={[{ term: f.options, value: request.options.join(', ') || null }]} />
      </div>
    );
  }
  const frequency = request.frequency
    ? (form?.frequencies.find((item) => item.code === request.frequency)?.label ?? request.frequency)
    : null;
  const items = answerItems(request.answers, form?.fields ?? []);
  return (
    <div className="grid gap-4">
      {items.length ? <DescriptionList items={items} /> : <Note>{t.noAnswers}</Note>}
      {request.selectedOptions.map((selection) => {
        const option = form?.options.find((item) => item.code === selection.code);
        return (
          <div key={selection.code} className="border-line grid gap-2 border-l-2 pl-3">
            <p className="text-ink font-semibold">{t.option(option?.label ?? selection.code)}</p>
            <DescriptionList items={answerItems(selection.answers, option?.fields ?? [])} />
          </div>
        );
      })}
      <DescriptionList items={[{ term: f.frequency, value: frequency }]} />
    </div>
  );
}

function Answers({ request }: { request: QuoteRequest }) {
  const form = useServiceForm(request.serviceCode) ?? null;
  const context = [
    { term: f.recurrence, value: request.recurrence ? recurrenceText(request.recurrence) : null },
    { term: f.daysPerWeek, value: request.daysPerWeek },
    { term: f.requestedTeamSize, value: request.requestedTeamSize },
  ];
  return (
    <div className="grid gap-4">
      {request.answerSummary ? (
        <SummaryList summary={request.answerSummary} />
      ) : (
        <RawAnswers request={request} form={form} />
      )}
      <DescriptionList items={context} />
    </div>
  );
}

/** Prix annoncé au client : calcul du serveur à la demande (ADR-033), affiché tel quel. */
export function CalculationView({ request }: { request: QuoteRequest }) {
  const calculation = request.calculation;
  const c = t.calc;
  if (!calculation) {
    return request.estimate ? (
      <div className="grid gap-2">
        <Note>{c.legacy}</Note>
        <p className="tabular-nums">
          {c.estimate} : {formatXof(request.estimate.low)} – {formatXof(request.estimate.high)}
        </p>
      </div>
    ) : (
      <Note>{c.none}</Note>
    );
  }
  return (
    <div className="grid gap-4">
      {!calculation.priced ? (
        <Note>
          {c.notPriced}
          {calculation.reason ? ` : ${c.reasons[calculation.reason] ?? calculation.reason}` : ''}.
        </Note>
      ) : null}
      <CalculationDetails calculation={calculation} />
    </div>
  );
}

/**
 * Étape « Demande » : le lieu et la prestation d'abord (type de lieu, prestation, commune, position, repère,
 * créneaux), les réponses lisibles du client, puis le client et le prix annoncé.
 */
export function RequestFacts({ request, serviceName }: { request: QuoteRequest; serviceName: string }) {
  const commune = request.geocodingProvider
    ? `${request.commune} (${t.communeSource.geocoded})`
    : `${request.commune} (${t.communeSource.chosen})`;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Block title={t.place} id="demande-lieu">
        <DescriptionList
          items={[
            { term: f.placeType, value: request.placeTypeLabel ?? request.placeType },
            { term: f.service, value: serviceName },
            { term: f.commune, value: commune },
            { term: f.landmark, value: request.landmark },
            { term: f.address, value: request.address !== request.landmark ? request.address : null },
            { term: f.geocodedAddress, value: request.geocodedAddress },
            {
              term: f.position,
              value: request.location ? <PositionText location={request.location} /> : t.noPosition,
            },
            {
              term: f.preferredSlots,
              value: request.preferredSlots.length ? (
                <ul className="grid gap-1">
                  {request.preferredSlots.map((slot) => (
                    <li key={slot.start}>{formatSlot(slot)}</li>
                  ))}
                </ul>
              ) : null,
            },
          ]}
        />
      </Block>
      <Block title={t.answers} id="demande-reponses">
        <Answers request={request} />
      </Block>
      <Block title={t.customer} id="demande-client">
        <DescriptionList
          items={[
            { term: f.customerName, value: nameOr(request.customerName, common.unnamed) },
            { term: f.kind, value: customerKind(request.customerKind) },
            {
              term: f.organizationName,
              value: request.organizationId ? nameOr(request.organizationName, common.unnamedBusiness) : null,
            },
            { term: f.comment, value: request.comment },
            { term: f.closingReason, value: request.closingReason },
          ]}
        />
      </Block>
      <Block title={t.calculation} id="demande-calcul">
        <CalculationView request={request} />
      </Block>
    </div>
  );
}
