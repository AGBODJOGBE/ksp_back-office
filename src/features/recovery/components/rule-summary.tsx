import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { DescriptionList } from '@/components/ui/description-list';
import { formatDate, formatDateTime, formatXof } from '@/lib/format';
import { editorTexts } from '@/features/recovery/pricing-editor-texts';
import { tiersAreRates } from '@/features/recovery/pricing-form';
import type { Rule } from '@/features/recovery/pricing-schemas';
import {
  modeLabel,
  objectLabel,
  offerLabel,
  pricingTexts,
  ruleStatus,
} from '@/features/recovery/pricing-texts';
import { recoveryPaths } from '@/features/recovery/paths';
import { actorName, formatBps, stageGroupLabel } from '@/features/recovery/texts';

const p = pricingTexts;

/** Calcul d'une règle en clair, une phrase par tranche ou par étape. */
export function ruleCalculation(rule: Rule): string[] {
  switch (rule.mode) {
    case 'fixed':
      return [rule.fixedAmount ? formatXof(rule.fixedAmount) : '—'];
    case 'percentage':
      return [rule.rateBps === null ? '—' : formatBps(rule.rateBps)];
    case 'by_stage':
      return rule.stageRates.map(
        (rate) => `${stageGroupLabel(rate.stageGroup)} : ${formatBps(rate.rateBps)}`,
      );
    case 'tiered': {
      const rates = tiersAreRates(rule.object);
      let from = 0;
      return rule.tiers.map((tier) => {
        const to = tier.upTo ? tier.upTo.amount : null;
        const sentence = rates
          ? editorTexts.tiers.rangeCommission(from, to, formatBps(Math.max(tier.rateBps ?? 0, 0)))
          : editorTexts.tiers.rangeFee(from, to, formatXof(tier.fixedAmount?.amount ?? 0));
        if (to !== null) from = to;
        return sentence;
      });
    }
    default:
      return [];
  }
}

/** Cible en clair : offre, commune, créancier précis. */
export function ruleTarget(rule: Rule): string {
  const parts = [offerLabel(rule.target.offer)];
  parts.push(rule.target.communeKey ? p.target.commune(rule.target.communeKey) : p.target.allCommunes);
  if (rule.target.creditor) {
    parts.push(
      `${p.target.negotiated} (${p.target.creditor(rule.target.creditor.type, rule.target.creditor.id)})`,
    );
  }
  return parts.join(' · ');
}

export function ruleValidity(rule: Rule): string {
  return rule.validUntil
    ? p.validity.range(formatDate(rule.validFrom), formatDate(rule.validUntil))
    : p.validity.from(formatDate(rule.validFrom));
}

export function RuleStatusBadge({ status }: { status: string }) {
  const badge = ruleStatus(status);
  return (
    <Badge tone={badge.tone} dot>
      {badge.label}
    </Badge>
  );
}

/** Fiche d'une règle en lecture : calcul, bornes, cible, validité, auteur et validation. */
export function RuleSummary({ rule }: { rule: Rule }) {
  const lines = ruleCalculation(rule);
  const bounds = [
    rule.minimum ? p.bounds.min(formatXof(rule.minimum)) : null,
    rule.maximum ? p.bounds.max(formatXof(rule.maximum)) : null,
  ].filter(Boolean);
  return (
    <DescriptionList
      items={[
        { term: p.list.columns.object, value: objectLabel(rule.object) },
        {
          term: p.list.columns.mode,
          value: (
            <div className="grid gap-1">
              <span className="font-semibold">{modeLabel(rule.mode)}</span>
              {lines.length > 1 ? (
                <ul className="list-disc pl-5">
                  {lines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ) : (
                <span>{lines[0]}</span>
              )}
            </div>
          ),
        },
        { term: p.bounds.title, value: bounds.length ? bounds.join(' · ') : p.list.none },
        { term: p.list.columns.target, value: ruleTarget(rule) },
        { term: p.list.columns.validity, value: ruleValidity(rule) },
        { term: p.detail.createdBy, value: actorName(rule.createdBy) },
        { term: p.detail.approvedBy, value: rule.approvedBy ? actorName(rule.approvedBy) : null },
        { term: p.detail.publishedAt, value: rule.publishedAt ? formatDateTime(rule.publishedAt) : null },
        {
          term: p.detail.previous,
          value: rule.previousVersionId ? (
            <Link
              href={recoveryPaths.rule(rule.previousVersionId)}
              className="text-accent-ink font-semibold underline-offset-4 hover:underline"
            >
              {p.detail.openPrevious}
            </Link>
          ) : null,
        },
      ]}
    />
  );
}
