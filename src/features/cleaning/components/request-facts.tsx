'use client';

import type { ReactNode } from 'react';
import { DescriptionList } from '@/components/ui/description-list';
import { Heading } from '@/components/ui/heading';
import { ResponsiveTable } from '@/components/ui/responsive-table';
import { formatSlot, formatXof } from '@/lib/format';
import { requestTexts as t } from '@/features/cleaning/request-detail-texts';
import type {
  Calculation,
  FormField,
  GeoLocation,
  QuoteRequest,
  ServiceForm,
} from '@/features/cleaning/schemas';
import { cleaningTexts, customerKind, nameOr, recurrenceText } from '@/features/cleaning/texts';
import { Note } from './parts';
import { useServiceForm } from './use-service-names';

const common = cleaningTexts.common;
const f = t.fields;

const decimal = new Intl.NumberFormat('fr-BJ', { maximumFractionDigits: 6 });
const factor = new Intl.NumberFormat('fr-BJ', { maximumFractionDigits: 4 });

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

/** Position en texte seul (coordonnées, précision) : ni carte, ni lien vers un service externe. */
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
    </span>
  );
}

/** Valeur d'une réponse en clair : nombre avec son unité, libellé de la valeur choisie, oui ou non. */
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

function Answers({ request, form }: { request: QuoteRequest; form: ServiceForm | null }) {
  const frequency = request.frequency
    ? (form?.frequencies.find((item) => item.code === request.frequency)?.label ?? request.frequency)
    : null;
  const context = [
    { term: f.frequency, value: frequency },
    { term: f.recurrence, value: request.recurrence ? recurrenceText(request.recurrence) : null },
    { term: f.daysPerWeek, value: request.daysPerWeek },
    { term: f.requestedTeamSize, value: request.requestedTeamSize },
    { term: f.recommendedTeamSize, value: request.recommendedTeamSize },
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
  ];
  if (!request.answers) {
    return (
      <div className="grid gap-3">
        <Note>{t.legacyAnswers}</Note>
        <DescriptionList
          items={[{ term: f.options, value: request.options.join(', ') || null }, ...context]}
        />
      </div>
    );
  }
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
      <DescriptionList items={context} />
    </div>
  );
}

const money = (value: { amount: number } | null) => (value ? formatXof(value.amount) : null);

/** Détail du calcul fait par le serveur à la demande (ADR-033), affiché tel quel : le front ne recalcule rien. */
export function CalculationView({ request }: { request: QuoteRequest }) {
  const calculation: Calculation | null = request.calculation;
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
      <p className="text-small text-ink-muted">
        {calculation.pricingVersion !== null ? c.version(calculation.pricingVersion) : null}
      </p>
      {!calculation.priced ? (
        <Note>
          {c.notPriced}
          {calculation.reason ? ` : ${c.reasons[calculation.reason] ?? calculation.reason}` : ''}.
        </Note>
      ) : null}
      {calculation.lines.length ? (
        <ResponsiveTable
          caption={c.lines}
          rows={calculation.lines.map((line, index) => ({ ...line, key: String(index) }))}
          rowKey={(line) => line.key}
          columns={[
            { key: 'label', header: c.columns.label, primary: true, cell: (line) => line.label },
            {
              key: 'quantity',
              header: c.columns.quantity,
              className: 'tabular-nums',
              cell: (line) => (line.unitLabel ? `${line.quantity} ${line.unitLabel}` : line.quantity),
            },
            {
              key: 'unitPrice',
              header: c.columns.unitPrice,
              className: 'tabular-nums',
              cell: (line) => formatXof(line.unitPrice),
            },
            {
              key: 'amount',
              header: c.columns.amount,
              className: 'tabular-nums',
              cell: (line) => formatXof(line.amount),
            },
          ]}
        />
      ) : null}
      <DescriptionList
        items={[
          { term: c.base, value: money(calculation.baseAmount) },
          {
            term: c.coefficients,
            value: calculation.coefficients.length ? (
              <ul className="grid gap-1">
                {calculation.coefficients.map((item, index) => (
                  <li key={index}>{c.coefficient(item.label, factor.format(item.coefficientBp / 10_000))}</li>
                ))}
              </ul>
            ) : null,
          },
          { term: c.subtotal, value: money(calculation.subtotal) },
          {
            term: c.minimum,
            value: calculation.minimumPrice
              ? `${formatXof(calculation.minimumPrice)}${calculation.minimumApplied ? ` (${c.minimumApplied})` : ''}`
              : null,
          },
          {
            term: c.computed,
            value: calculation.computedPrice ? <strong>{formatXof(calculation.computedPrice)}</strong> : null,
          },
          {
            term: c.estimate,
            value: calculation.estimate
              ? `${formatXof(calculation.estimate.low)} – ${formatXof(calculation.estimate.high)}`
              : null,
          },
          { term: c.recommendedTeamSize, value: calculation.recommendedTeamSize },
        ]}
      />
    </div>
  );
}

/** Étape « Demande » : client, lieu (type, repère, adresses, position), réponses et calcul du serveur. */
export function RequestFacts({ request }: { request: QuoteRequest }) {
  const form = useServiceForm(request.serviceCode);
  const commune = request.geocodingProvider
    ? `${request.commune} (${t.communeSource.geocoded})`
    : `${request.commune} (${t.communeSource.chosen})`;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Block title={t.customer} id="demande-client">
        <DescriptionList
          items={[
            { term: f.kind, value: customerKind(request.customerKind) },
            { term: f.customerName, value: nameOr(request.customerName, common.unnamed) },
            {
              term: f.organizationName,
              value: request.organizationId ? nameOr(request.organizationName, common.unnamedBusiness) : null,
            },
            { term: f.comment, value: request.comment },
            { term: f.closingReason, value: request.closingReason },
          ]}
        />
      </Block>
      <Block title={t.place} id="demande-lieu">
        <DescriptionList
          items={[
            { term: f.placeType, value: request.placeTypeLabel ?? request.placeType },
            { term: f.landmark, value: request.landmark },
            { term: f.address, value: request.address !== request.landmark ? request.address : null },
            { term: f.geocodedAddress, value: request.geocodedAddress },
            { term: f.commune, value: commune },
            {
              term: f.position,
              value: request.location ? <PositionText location={request.location} /> : t.noPosition,
            },
          ]}
        />
      </Block>
      <Block title={t.answers} id="demande-reponses">
        <Answers request={request} form={form} />
      </Block>
      <Block title={t.calculation} id="demande-calcul">
        <CalculationView request={request} />
      </Block>
    </div>
  );
}
