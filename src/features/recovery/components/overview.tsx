'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ResponsiveTable, type TableColumn } from '@/components/ui/responsive-table';
import { formatXof } from '@/lib/format';
import { useResource } from '@/lib/use-resource';
import { getOverview } from '@/features/recovery/api';
import { overviewTexts as t } from '@/features/recovery/overview-texts';
import { recoveryPaths } from '@/features/recovery/paths';
import type { AgentPerformance, Overview as OverviewData, StageCount } from '@/features/recovery/schemas';
import { actorName, formatBps, kindLabel, stageGroupLabel, stageLabel } from '@/features/recovery/texts';
import { Note, Panel, ResourceView, useRecoveryAccess } from './parts';

const LINK = 'text-accent-ink font-semibold underline-offset-4 hover:underline';

/** Chiffre clé : libellé, valeur, précision. */
function Figure({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-card border-line bg-surface grid content-start gap-1 border p-4">
      <dt className="text-small text-ink-muted font-medium">{label}</dt>
      <dd className="font-display text-h3 text-ink font-semibold tabular-nums">{value}</dd>
      {hint ? <dd className="text-small text-ink-muted">{hint}</dd> : null}
    </div>
  );
}

/** Ligne d'une file en attente : compteur, lien vers la file filtrée quand elle existe. */
function QueueLine({
  label,
  count,
  href,
  hint,
}: {
  label: string;
  count: number;
  href?: string;
  hint?: string;
}) {
  const body: ReactNode = (
    <>
      <span className="font-display text-h3 min-w-10 font-semibold tabular-nums">{count}</span>{' '}
      <span>{label}</span>
    </>
  );
  return (
    <li className="border-line grid gap-1 border-t py-3 first:border-t-0 first:pt-0">
      {href ? (
        // Nom accessible = texte visible (« 6 Recevabilité à décider »), WCAG 2.5.3.
        <Link href={href} className={`${LINK} flex items-center gap-3`}>
          {body}
        </Link>
      ) : (
        <span className="text-ink flex items-center gap-3 font-semibold">{body}</span>
      )}
      {hint ? <span className="text-small text-ink-muted">{hint}</span> : null}
    </li>
  );
}

function countColumns(
  header: string,
  label: (code: string) => string,
  href: (code: string) => string,
): TableColumn<StageCount>[] {
  return [
    {
      key: 'stage',
      header,
      primary: true,
      cell: (row) => (
        <Link href={href(row.stage)} className={`${LINK} stretched-link`}>
          {label(row.stage)}
        </Link>
      ),
    },
    {
      key: 'count',
      header: t.byStage.count,
      cell: (row) => <span className="tabular-nums">{row.count}</span>,
    },
  ];
}

const agentColumns: TableColumn<AgentPerformance>[] = [
  {
    key: 'agent',
    header: t.agents.agent,
    primary: true,
    cell: (row) =>
      row.agent.userId ? (
        <Link
          href={recoveryPaths.casesWith({ agentId: row.agent.userId })}
          aria-label={t.agents.seeCases(actorName(row.agent))}
          className={`${LINK} stretched-link`}
        >
          {actorName(row.agent)}
        </Link>
      ) : (
        actorName(row.agent)
      ),
  },
  {
    key: 'open',
    header: t.agents.open,
    cell: (row) => <span className="tabular-nums">{row.openCases}</span>,
  },
  {
    key: 'recovered',
    header: t.agents.recovered,
    cell: (row) => <span className="tabular-nums">{formatXof(row.recovered)}</span>,
  },
  {
    key: 'rate',
    header: t.agents.rate,
    cell: (row) => <span className="tabular-nums">{formatBps(row.recoveryRateBps)}</span>,
  },
];

function OverviewContent({ data, offlineLink }: { data: OverviewData; offlineLink: boolean }) {
  return (
    <div className="grid gap-6">
      <section aria-labelledby="recouvrement-sommes" className="grid gap-3">
        <h2 id="recouvrement-sommes" className="sr-only">
          {t.money.title}
        </h2>
        <dl className="grid gap-3 sm:grid-cols-3">
          <Figure label={t.money.entrusted} value={formatXof(data.entrusted)} hint={t.money.entrustedHint} />
          <Figure label={t.money.recovered} value={formatXof(data.recovered)} />
          <Figure label={t.money.rate} value={formatBps(data.recoveryRateBps)} />
        </dl>
      </section>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={t.queues.title} id="recouvrement-attente">
          <ul className="grid">
            <QueueLine
              label={t.queues.review}
              count={data.reviewQueue}
              href={recoveryPaths.casesWith({ status: 'under_review' })}
            />
            <QueueLine
              label={t.queues.offline}
              count={data.offlinePaymentsToApprove}
              href={offlineLink ? recoveryPaths.offlinePayments : undefined}
            />
            <QueueLine
              label={t.queues.idle}
              count={data.idleCases}
              href={recoveryPaths.casesWith({ idleDays: 7 })}
            />
            <QueueLine
              label={t.queues.prescriptions}
              count={data.prescriptionsNear}
              href={recoveryPaths.casesWith({ prescriptionNear: true })}
            />
            <QueueLine
              label={t.queues.installments}
              count={data.installmentsDueToday}
              hint={t.queues.installmentsHint}
            />
            <QueueLine label={t.queues.promises} count={data.promisesToCheck} hint={t.queues.promisesHint} />
          </ul>
        </Panel>
        <Panel title={t.rates.title} id="recouvrement-taux">
          {data.recoveryRateByStageBps.length ? (
            <dl className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              {data.recoveryRateByStageBps.map((row) => (
                <Figure key={row.stage} label={stageGroupLabel(row.stage)} value={formatBps(row.count)} />
              ))}
            </dl>
          ) : (
            <Note>{t.rates.empty}</Note>
          )}
        </Panel>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={t.byStage.title} id="recouvrement-etapes">
          {data.casesByStage.length ? (
            <ResponsiveTable
              caption={t.byStage.caption}
              columns={countColumns(t.byStage.stage, stageLabel, (stage) =>
                recoveryPaths.casesWith({ stage }),
              )}
              rows={data.casesByStage}
              rowKey={(row) => row.stage}
            />
          ) : (
            <Note>{t.byStage.empty}</Note>
          )}
        </Panel>
        <Panel title={t.byKind.title} id="recouvrement-offres">
          {data.casesByKind.length ? (
            <ResponsiveTable
              caption={t.byKind.caption}
              columns={countColumns(t.byKind.kind, kindLabel, (kind) => recoveryPaths.casesWith({ kind }))}
              rows={data.casesByKind}
              rowKey={(row) => row.stage}
            />
          ) : (
            <Note>{t.byKind.empty}</Note>
          )}
        </Panel>
      </div>
      <Panel title={t.agents.title} id="recouvrement-charges">
        {data.agents.length ? (
          <ResponsiveTable
            caption={t.agents.caption}
            columns={agentColumns}
            rows={data.agents}
            rowKey={(row) => row.agent.userId ?? actorName(row.agent)}
          />
        ) : (
          <Note>{t.agents.empty}</Note>
        )}
      </Panel>
    </div>
  );
}

/** Tableau de bord du recouvrement : chiffres du contrat et liens vers les files filtrées. */
export function Overview() {
  const access = useRecoveryAccess();
  const resource = useResource(getOverview);
  return (
    <ResourceView resource={resource} lines={6}>
      {(data) => <OverviewContent data={data} offlineLink={!!access?.offlinePayments} />}
    </ResourceView>
  );
}
