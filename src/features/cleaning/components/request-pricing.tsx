'use client';

import { Badge } from '@/components/ui/badge';
import { DescriptionList } from '@/components/ui/description-list';
import { formatDuration } from '@/lib/format';
import { retainedTexts } from '@/features/cleaning/request-work-texts';
import type { Pricing } from '@/features/cleaning/schemas';
import { Amount } from './parts';

const t = retainedTexts;

/** Résumé d'un calcul : état, prix d'une séance, prix par type, équipe et durée proposées. */
export function PricingSummary({ pricing }: { pricing: Pricing }) {
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={pricing.status === 'priced' ? 'success' : 'warning'} dot>
          {t.pricingStatus[pricing.status] ?? pricing.status}
        </Badge>
      </div>
      <DescriptionList
        items={[
          {
            term: t.sessionPrice,
            value: pricing.sessionPrice === null ? null : <Amount value={pricing.sessionPrice} />,
          },
          ...pricing.offers.map((offer) => ({
            term: offer.name,
            value: offer.status === 'on_quote' ? t.onQuote : <Amount value={offer.price} />,
          })),
          { term: t.teamLabel, value: pricing.teamSize === null ? null : t.team(pricing.teamSize) },
          {
            term: t.duration,
            value: pricing.durationMinutes === null ? null : formatDuration(pricing.durationMinutes),
          },
        ]}
      />
    </div>
  );
}
