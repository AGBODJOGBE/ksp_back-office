'use client';

import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/format';
import { assignTexts } from '@/features/cleaning/assignment-texts';
import type { AgentCheck, CheckResult } from '@/features/cleaning/planning-schemas';
import { checkNames } from '@/features/cleaning/planning-texts';
import { failedResults, itemTimes } from '@/features/cleaning/planning-view';

const t = assignTexts;

/** Détail d'un contrôle en échec : compétences manquantes, chevauchements, indisponibilité. */
function ResultDetail({ result }: { result: CheckResult }) {
  const details: string[] = [];
  if (result.missingSkills.length) details.push(t.missingSkills(result.missingSkills.join(', ')));
  for (const conflict of result.conflicts) {
    const times = itemTimes(conflict);
    details.push(t.conflict(times.start, times.end, conflict.travelMinutes));
  }
  if (result.unavailabilityStart && result.unavailabilityEnd) {
    details.push(
      t.unavailable(formatDateTime(result.unavailabilityStart), formatDateTime(result.unavailabilityEnd)),
    );
  }
  return details.length ? (
    <ul className="text-small text-ink-muted list-disc pl-5">
      {details.map((detail) => (
        <li key={detail}>{detail}</li>
      ))}
    </ul>
  ) : null;
}

/** Contrôles d'un agent : réussite, ou alertes une à une (contournable ou non, contourné). */
function AgentReport({ check, name }: { check: AgentCheck; name: string }) {
  const failed = failedResults(check);
  const overridden = check.results.filter((result) => result.overridden);
  return (
    <li className="rounded-control border-line grid gap-2 border p-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-ink font-semibold">{name}</span>
        <Badge tone={check.passed ? 'success' : 'danger'} dot>
          {check.passed ? t.agentPassed : t.agentFailed}
        </Badge>
      </div>
      {failed.length || overridden.length ? (
        <ul className="grid gap-2">
          {[...failed, ...overridden].map((result) => (
            <li key={result.check} className="grid gap-1">
              <span className="text-ink">
                {checkNames[result.check]}
                <span className="text-small text-ink-muted">
                  {' — '}
                  {result.overridden ? t.overridden : result.overridable ? t.overridable : t.notOverridable}
                </span>
              </span>
              <ResultDetail result={result} />
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/**
 * Rapport des contrôles (`CleaningAgentCheck[]`) : un bloc par agent, alertes lisibles. Les noms
 * viennent de la liste des agents de l'écran (identifiant abrégé sinon).
 */
export function ChecksReport({
  checks,
  names,
  title = t.reportTitle,
}: {
  checks: readonly AgentCheck[];
  names: ReadonlyMap<string, string>;
  title?: string;
}) {
  if (!checks.length) return null;
  return (
    <section aria-label={title} className="grid gap-2">
      <h4 className="text-ink font-semibold">{title}</h4>
      <ul className="grid gap-2">
        {checks.map((check) => (
          <AgentReport
            key={`${check.agentId}-${check.target.id}`}
            check={check}
            name={names.get(check.agentId) ?? t.someone(check.agentId)}
          />
        ))}
      </ul>
    </section>
  );
}
