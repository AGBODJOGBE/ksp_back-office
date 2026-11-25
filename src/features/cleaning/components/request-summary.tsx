'use client';

import { Badge } from '@/components/ui/badge';
import { DescriptionList } from '@/components/ui/description-list';
import { formatDate, formatDateTime, formatSlot } from '@/lib/format';
import { feeStatus, requestDetailTexts } from '@/features/cleaning/request-detail-texts';
import type { CleaningRequest, VisitFee } from '@/features/cleaning/requests-schemas';
import { customerKindName } from '@/features/cleaning/requests-texts';
import { retainedTexts } from '@/features/cleaning/request-work-texts';
import { RequestDecisions } from './request-decisions';
import { PhotoLinks, StatusBadge, type StepProps, StepSection } from './request-parts';
import { Amount } from './parts';

const t = requestDetailTexts.request;

function Fee({ fee }: { fee: VisitFee }) {
  const dates = [
    fee.status === 'awaiting_payment' && fee.payBefore ? t.payBefore(formatDateTime(fee.payBefore)) : null,
    fee.paidAt ? t.paidAt(formatDate(fee.paidAt)) : null,
    fee.refundedAt ? t.refundedAt(formatDate(fee.refundedAt)) : null,
  ].filter(Boolean);
  return (
    <span className="flex flex-wrap items-center gap-2">
      <Amount value={fee.amount} />
      <StatusBadge status={feeStatus(fee.status)} />
      {dates.length ? <span className="text-small text-ink-muted">{dates.join(' · ')}</span> : null}
    </span>
  );
}

/** Prix d'une séance estimé à la demande (montant masqué sans le droit de voir les montants). */
function DeclaredPrice({ request }: { request: CleaningRequest }) {
  const pricing = request.declaredPricing;
  return (
    <span className="flex flex-wrap items-center gap-2">
      {pricing.sessionPrice === null ? null : <Amount value={pricing.sessionPrice} />}
      <Badge tone={pricing.status === 'priced' ? 'success' : 'warning'}>
        {retainedTexts.pricingStatus[pricing.status] ?? pricing.status}
      </Badge>
    </span>
  );
}

/** Étape 1 « Demande » : client, lieu, réponses, frais de visite ; refus, position, réactivation. */
export function RequestSummary(props: StepProps) {
  const { request } = props;
  const { place } = request;
  const customer = request.customerKind === 'organization' ? request.organizationName : request.customerName;
  const location = place.location;
  const previousFees = request.visitFees.filter((fee) => fee.id !== request.visitFee.id);
  return (
    <StepSection step="request" title={t.title}>
      <DescriptionList
        items={[
          { term: t.customer, value: customer?.trim() || t.noName },
          { term: t.customerKind, value: customerKindName(request.customerKind) },
          { term: t.place, value: place.name },
          { term: t.placeType, value: place.placeTypeName },
          { term: t.commune, value: place.communeName },
          { term: t.address, value: location?.address ?? null },
          { term: t.readableAddress, value: location?.readableAddress ?? null },
          { term: t.landmark, value: location ? location.landmark : t.locationHidden },
          {
            term: t.coordinates,
            value: location
              ? t.coordinatesValue(location.latitude, location.longitude, location.accuracyMeters)
              : null,
          },
          { term: t.types, value: request.cleaningTypes.map((type) => type.name).join(', ') },
          { term: t.declaredPrice, value: <DeclaredPrice request={request} /> },
          { term: t.fee, value: <Fee fee={request.visitFee} /> },
        ]}
      />
      {previousFees.length ? (
        <div className="grid gap-2">
          <h3 className="text-ink font-semibold">{t.feeHistory}</h3>
          <ul className="grid gap-2">
            {previousFees.map((fee) => (
              <li key={fee.id} className="flex flex-wrap items-center gap-2">
                <span className="text-ink-muted">{t.feeRank(fee.rank)}</span>
                <Fee fee={fee} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="grid gap-2">
        <h3 className="text-ink font-semibold">{t.answers}</h3>
        {request.declaredRows.length ? (
          <DescriptionList
            items={request.declaredRows.map((row) => ({ term: row.label, value: row.display }))}
          />
        ) : (
          <p className="text-small text-ink-muted">{t.noAnswer}</p>
        )}
      </div>
      <DescriptionList
        items={[
          { term: t.freeDescription, value: request.freeDescription },
          { term: t.comment, value: request.comment },
          {
            term: t.slots,
            value: request.visitSlots.length ? (
              <ul className="grid gap-1">
                {request.visitSlots.map((slot) => (
                  <li key={slot.start}>{formatSlot(slot)}</li>
                ))}
              </ul>
            ) : null,
          },
          {
            term: t.photos,
            value: request.photos.length ? <PhotoLinks photos={request.photos} label={t.photo} /> : null,
          },
        ]}
      />
      <RequestDecisions {...props} />
    </StepSection>
  );
}
